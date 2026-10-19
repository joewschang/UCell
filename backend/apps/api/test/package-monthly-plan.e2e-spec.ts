import {Prisma} from '@prisma/client';
import {packageMonthlyPlan} from '../../../packages/database/src/package-monthly-plan';

describe('repurchase monthly volume policy',()=>{
 it.each([['ACTIVE_QUARTER','6000',2,3],['ACTIVE_HALF_YEAR','12000',4,6],['ACTIVE_YEAR','24000',8,12]] as const)('%s conserves paid value and every volume type before and after box returns',(packageCode,price,boxCount,months)=>{
  for(let returnedBoxes=0;returnedBoxes<=boxCount;returnedBoxes++){
   const result=packageMonthlyPlan({packageCode,priceAmount:new Prisma.Decimal(price),boxCount,paidAt:new Date('2026-12-31T15:59:59Z'),timing:'PAYMENT_THEN_MONTH_START',returnedBoxes});
   expect(result.installments).toHaveLength(months);
   expect(result.returnedCash.toString()).toBe(String(returnedBoxes*3000));
   for(const field of ['gpv','rpv','epv'] as const){
    expect(result.installments.reduce((n,row)=>n.add(row[field]),new Prisma.Decimal(0)).eq(result.totalCash.mul('0.6'))).toBe(true);
    if(returnedBoxes===0)expect(result.installments.map(row=>row[field].toString())).toEqual(Array(months).fill('1200'));
   }
   expect(result.installments.reduce((n,row)=>n.add(row.cash),new Prisma.Decimal(0)).eq(result.totalCash)).toBe(true);
   expect(result.installments[1].dueAt.toISOString()).toBe('2026-12-31T16:00:00.000Z');
  }
 });
 it('uses an explicit Taiwan month boundary and rejects an unspecified calendar',()=>{
  const input={packageCode:'ACTIVE_QUARTER',priceAmount:new Prisma.Decimal(6000),boxCount:2,paidAt:new Date('2026-12-31T16:00:00Z')};
  expect(packageMonthlyPlan({...input,timing:'NEXT_MONTH_START'}).installments[0].dueAt.toISOString()).toBe('2027-01-31T16:00:00.000Z');
  expect(()=>packageMonthlyPlan({...input,timing:undefined as any})).toThrow('REPURCHASE_CALENDAR_REQUIRED');
  expect(()=>packageMonthlyPlan({...input,timing:'NEXT_MONTH_START',returnedBoxes:3})).toThrow('PACKAGE_RETURN_QUANTITY_INVALID');
 });
});
