import {Prisma} from '@prisma/client';
import {taipeiMonth} from './recognition-active';

export type PackageMonthlyTiming='PAYMENT_THEN_MONTH_START'|'NEXT_MONTH_START';
const plans:Record<string,{price:string;boxes:number;months:number}>={
 ACTIVE_QUARTER:{price:'6000',boxes:2,months:3},
 ACTIVE_HALF_YEAR:{price:'12000',boxes:4,months:6},
 ACTIVE_YEAR:{price:'24000',boxes:8,months:12},
};

/** No implicit calendar choice: the caller must supply the approved first-period rule. */
export function packageMonthlyPlan(input:{packageCode:string;priceAmount:Prisma.Decimal;boxCount:number;paidAt:Date;timing:PackageMonthlyTiming;returnedBoxes?:number}){
 const plan=plans[input.packageCode],returned=input.returnedBoxes??0;
 if(!plan||!input.priceAmount.eq(plan.price)||input.boxCount!==plan.boxes)throw new Error('REPURCHASE_PACKAGE_POLICY_MISMATCH');
 if(!['PAYMENT_THEN_MONTH_START','NEXT_MONTH_START'].includes(input.timing))throw new Error('REPURCHASE_CALENDAR_REQUIRED');
 if(!Number.isInteger(returned)||returned<0||returned>plan.boxes)throw new Error('PACKAGE_RETURN_QUANTITY_INVALID');
 const month=taipeiMonth(input.paidAt),localMonth=month.calendarMonth;
 const totalCash=input.priceAmount.mul(plan.boxes-returned).div(plan.boxes);
 const totalVolume=totalCash.mul('0.6');
 let cashAllocated=new Prisma.Decimal(0),volumeAllocated=new Prisma.Decimal(0);
 const installments=Array.from({length:plan.months},(_,index)=>{
  const shift=index+(input.timing==='NEXT_MONTH_START'?1:0);
  const periodStart=new Date(Date.UTC(localMonth.getUTCFullYear(),localMonth.getUTCMonth()+shift,1)-8*3600000);
  const dueAt=index===0&&input.timing==='PAYMENT_THEN_MONTH_START'?input.paidAt:periodStart;
  const periodEnd=new Date(Date.UTC(localMonth.getUTCFullYear(),localMonth.getUTCMonth()+shift+1,1)-8*3600000);
  const cash=index===plan.months-1?totalCash.sub(cashAllocated):totalCash.div(plan.months).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
  const volume=index===plan.months-1?totalVolume.sub(volumeAllocated):cash.mul('0.6').toDecimalPlaces(4,Prisma.Decimal.ROUND_HALF_UP);
  cashAllocated=cashAllocated.add(cash);volumeAllocated=volumeAllocated.add(volume);
  return {installmentNo:index+1,dueAt,periodStart,periodEnd,cash,gpv:volume,rpv:volume,epv:volume};
 });
 return {months:plan.months,cashPerBox:input.priceAmount.div(plan.boxes),returnedCash:input.priceAmount.sub(totalCash),totalCash,totalGpv:totalVolume,totalRpv:totalVolume,totalEpv:totalVolume,installments};
}
