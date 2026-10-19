import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {preparePackageMonthlySchedule} from '../../../packages/database/src/package-monthly-schedule';
import {PackageConfigService} from '../src/modules/package-config/package-config.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('immutable prepaid package monthly preparation',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(()=>db.$disconnect());
 it.each([['ACTIVE_QUARTER','6000',2,3],['ACTIVE_HALF_YEAR','12000',4,6],['ACTIVE_YEAR','24000',8,12]] as const)('%s persists payment-first Taiwan monthly schedule exactly once',(async(packageCode,price,boxes,months)=>{
  const person=await db.person.create({data:{legalName:'ISOLATED MONTHLY OWNER',status:'EFFECTIVE'}});
  const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,status:'EFFECTIVE',planLevelCode:'STARTER'}});
  const profile=await db.packageProfile.findUniqueOrThrow({where:{stableCode:packageCode}});
  const version=await new PackageConfigService(db as any).addVersion(profile.packageProfileId,{displayName:'Monthly fixture',currency:'TWD',priceAmount:price,selectableProductQuantity:boxes,membershipEffect:'NONE',qualificationEffect:'ACTIVE_ENTITLEMENT',activeDurationUnit:'MONTH',activeDurationValue:months,targetQualificationRequired:true,recognitionConfigRef:'PO_20261019_REPURCHASE_60'},'fixture');
  const paidAt=new Date('2040-12-31T15:59:59.000Z');
  const order=await db.order.create({data:{qualificationId:q.qualificationId,status:'PAID',purpose:'REPURCHASE',grossAmount:price,netAmount:price,paidAt,ruleVersionCode:'R1.0B'}});
  await db.packagePurchaseSnapshot.create({data:{orderId:order.orderId,personId:person.personId,targetQualificationId:q.qualificationId,packageProfileVersionId:version.packageProfileVersionId,packageCode,packageName:'Monthly fixture',packageClass:'ACTIVE_DURATION',currency:'TWD',priceAmount:price,selectableProductQuantity:boxes,membershipEffect:'NONE',qualificationEffect:'ACTIVE_ENTITLEMENT',activeDurationUnit:'MONTH',activeDurationValue:months,recognitionConfigRef:'PO_20261019_REPURCHASE_60',packageConfigHash:'a'.repeat(64),purchasedAt:paidAt}});
  const run=()=>db.$transaction(tx=>preparePackageMonthlySchedule(tx,order.orderId,randomUUID()),{isolationLevel:'Serializable'});
  const result=await run();expect(result.created).toBe(true);expect((await run()).created).toBe(false);
  expect(result.subscription.status).toBe('PENDING');
  const rows=result.subscription.schedules.sort((a,b)=>a.installmentNo-b.installmentNo);
  expect(rows).toHaveLength(months);expect(rows[0].dueAt).toEqual(paidAt);expect(rows[1].dueAt.toISOString()).toBe('2040-12-31T16:00:00.000Z');
  expect(rows.every(row=>row.recognizedAmount.eq(2000)&&row.rpvAmount.eq(1200))).toBe(true);
  expect(rows.reduce((sum,row)=>sum.add(row.recognizedAmount),new Prisma.Decimal(0)).toString()).toBe(price);
  expect(await db.pvLedger.count({where:{qualificationId:q.qualificationId}})).toBe(0);
  expect(await db.subscription.count({where:{orderId:order.orderId}})).toBe(1);
  expect(await db.auditEvent.count({where:{entityId:result.subscription.subscriptionId,action:'PACKAGE_MONTHLY_SCHEDULE_PREPARED'}})).toBe(1);
 }));
});
