import {Prisma, PrismaClient} from '@prisma/client';
import {createHash} from 'node:crypto';
import {captureParameters} from './parameter-snapshot';
import {taipeiMonth} from './recognition-active';
import {applyGpvImmediateEffects} from './gpv-immediate-effects';
import {OutboxLease, withOutboxLease} from './outbox-lease';
import {preplacementReturnedGpv} from './qualification-return-review';

export const qualificationPackagePolicy = 'PO_20261019_QUALIFICATION_GPV_ONLY';
const approved:Record<string,[string,number]>={STARTER:['14400',3],ELITE:['43200',9],LEADER:['72000',15]};

/** Immutable purchase facts, never today's product/catalog prices. */
export function qualificationPackageAllocation(purchase:{packageCode:string;packageClass:string;recognitionConfigRef:string;currency:string;priceAmount:Prisma.Decimal;selectableProductQuantity:number;qualificationFee?:Prisma.Decimal;discountAmount?:Prisma.Decimal},lines:Array<{quantity:Prisma.Decimal;ruleProfileSnapshot:unknown}>,netAmount:Prisma.Decimal){
 const basis=approved[purchase.packageCode];
 const modern=purchase.recognitionConfigRef==='PO_20261021_ENTRY_V2';
 const discount=new Prisma.Decimal(purchase.discountAmount??0),fee=new Prisma.Decimal(purchase.qualificationFee??0);
 const boxes=basis?basis[1]-(discount.eq(14400)?3:0):-1;
 if(purchase.packageClass!=='QUALIFICATION'||![qualificationPackagePolicy,'PO_20261021_ENTRY_V2'].includes(purchase.recognitionConfigRef)||purchase.currency!=='TWD'||!basis||modern&&(!fee.eq(600)||!discount.eq(0)&&!discount.eq(14400))||!modern&&(!fee.eq(0)||!discount.eq(0))||!purchase.priceAmount.eq(new Prisma.Decimal(basis[0]).sub(discount))||purchase.selectableProductQuantity!==boxes||!netAmount.eq(purchase.priceAmount.add(fee)))throw new Error('PACKAGE_RECOGNITION_POLICY_MISMATCH');
 if(lines.some(l=>!(l.ruleProfileSnapshot as any)?.packageSelection||!l.quantity.isInteger()||l.quantity.lte(0))||!lines.reduce((sum,l)=>sum.add(l.quantity),new Prisma.Decimal(0)).eq(boxes))throw new Error('PACKAGE_SELECTION_QUANTITY_MISMATCH');
 return {cashPerBox:boxes?purchase.priceAmount.div(boxes):new Prisma.Decimal(0),gpvPerBox:boxes?purchase.priceAmount.div(boxes).mul('0.6'):new Prisma.Decimal(0)};
}

/** Legacy purchases retain their Active policy; new entry purchases require independent Active eligibility. */
export async function recognizeQualificationPackage(tx:Prisma.TransactionClient,orderId:string,correlationId:string){
 await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_id=${orderId}::uuid FOR UPDATE`;
 const order=await tx.order.findUniqueOrThrow({where:{orderId},include:{lines:true}});
 const purchase=await tx.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId}});
 const allocation=qualificationPackageAllocation(purchase,order.lines,order.netAmount);
 if(!order.qualificationId||!order.paidAt||!['PAID','FULFILLED','PARTIAL_RETURN','RETURNED'].includes(order.status))throw new Error('PACKAGE_PAID_ORDER_REQUIRED');
 const setup=await tx.qualificationSetup.findUniqueOrThrow({where:{qualificationId:order.qualificationId}});
 if(setup.qualifyingOrderId!==orderId||setup.packagePurchaseSnapshotId!==purchase.packagePurchaseSnapshotId)throw new Error('PACKAGE_SETUP_EVIDENCE_MISMATCH');
 if(setup.setupStatus==='REVERSED'||setup.setupStatus==='CANCELLED')return {status:'CANCELLED',created:0};
 const month=taipeiMonth(order.paidAt);
 const entitlement=await tx.qualificationActiveEntitlementEvidence.findUnique({where:{packagePurchaseSnapshotId:purchase.packagePurchaseSnapshotId}});
 if(!entitlement&&purchase.recognitionConfigRef===qualificationPackagePolicy){
  const evidenceHash=createHash('sha256').update(JSON.stringify({orderId,paidAt:order.paidAt.toISOString(),end:month.end.toISOString(),policy:qualificationPackagePolicy})).digest('hex');
  await tx.qualificationActiveEntitlementEvidence.create({data:{qualificationId:order.qualificationId,packagePurchaseSnapshotId:purchase.packagePurchaseSnapshotId,entitlementType:'PAYMENT_MONTH_ACTIVE',periodStart:order.paidAt,periodEnd:month.end,policyVersion:qualificationPackagePolicy,evidenceHash,status:'GRANTED'}});
  await tx.activePeriod.create({data:{qualificationId:order.qualificationId,activeFrom:order.paidAt,activeTo:month.end,sourceType:'QUALIFICATION_PACKAGE',sourceId:purchase.packagePurchaseSnapshotId,ruleVersionCode:order.ruleVersionCode}});
 }
 const now=new Date();
 const active=await tx.activePeriod.count({where:{qualificationId:order.qualificationId,activeFrom:{lte:now},OR:[{activeTo:null},{activeTo:{gt:now}}]}});
 await tx.qualification.update({where:{qualificationId:order.qualificationId},data:{activeFlag:active>0}});
 if(setup.setupStatus!=='PLACED')return {status:'AWAITING_PLACEMENT',created:0};
 if(!setup.placedAt||setup.placedAt<order.paidAt)throw new Error('PACKAGE_PLACEMENT_TIMESTAMP_INVALID');
 const placement=await tx.placementEvidence.findFirst({where:{qualificationId:order.qualificationId,placedAt:setup.placedAt}});
 if(!placement)throw new Error('PACKAGE_PLACEMENT_EVIDENCE_MISSING');
 const parameters=await captureParameters(tx,setup.placedAt,order.ruleVersionCode);
 const policy=parameters.parameters.filter(p=>p.code==='OWNER_VOLUME_POLICY_20261019'&&p.scope==='*');
 const value=policy[0]?.value as any;
 if(order.ruleVersionCode!=='R1.0B'||policy.length!==1||value?.gpvRate!=='0.6'||value?.qualificationPackage?.gpv!==true||value?.qualificationPackage?.rpv!==false||value?.qualificationPackage?.epv!==false)throw new Error('PACKAGE_RUNTIME_POLICY_CONFLICT');
 let created=0;
 const beforePlacement=await preplacementReturnedGpv(tx,orderId);
 for(const line of order.lines){
  const excluded=beforePlacement.get(line.orderLineId)??new Prisma.Decimal(0);
  const amount=allocation.gpvPerBox.mul(line.quantity).sub(excluded);
  if(amount.lt(0))throw new Error('PACKAGE_RETURN_EXCEEDS_ORIGINAL');
  if(amount.eq(0))continue;
  const existing=await tx.pvLedger.findFirst({where:{sourceType:'ORDER',sourceId:orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',pvType:'GPV'}});
  if(existing){
   if(!existing.amount.eq(amount)||existing.occurredAt.getTime()!==setup.placedAt.getTime()||existing.qualificationId!==order.qualificationId)throw new Error('PACKAGE_VOLUME_EVIDENCE_CONFLICT');
   continue;
  }
  if(order.status==='RETURNED')throw new Error('RETURNED_PACKAGE_ORIGINAL_VOLUME_MISSING');
  const volume=await tx.pvLedger.create({data:{qualificationId:order.qualificationId,pvType:'GPV',amount,sourceType:'ORDER',sourceId:orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode:order.ruleVersionCode,parameterSnapshotHash:parameters.hash,occurredAt:setup.placedAt,correlationId}});
  await tx.volumeRecognitionClassification.create({data:{volumeEventId:volume.eventId,volumeClass:'PV',concreteVolumeType:'GPV',classificationVersion:qualificationPackagePolicy,ruleVersionCode:order.ruleVersionCode,evidenceHash:createHash('sha256').update(JSON.stringify({eventId:volume.eventId,policy:qualificationPackagePolicy,personalConsumptionEligible:false})).digest('hex')}});
  await applyGpvImmediateEffects(tx,volume,undefined,excluded.gt(0)?excluded.toString():undefined);
  created++;
 }
 return {status:'RECOGNIZED',created};
}

export async function processQualificationPackageEvent(db:PrismaClient,lease:OutboxLease){
 return withOutboxLease(db,lease,async tx=>{
  const event=await tx.outboxEvent.findUniqueOrThrow({where:{outboxEventId:lease.outboxEventId}});
  const payload=event.payload as any;
  let orderId:string|undefined;
  if(event.eventType==='PACKAGE_PAYMENT_CONFIRMED')orderId=payload.orderId;
  else if(event.eventType==='QUALIFICATION_PLACED')orderId=(await tx.qualificationSetup.findUnique({where:{qualificationId:payload.qualificationId}}))?.qualifyingOrderId??undefined;
  else throw new Error('PACKAGE_EVENT_TYPE_INVALID');
  if(orderId){
   const purchase=await tx.packagePurchaseSnapshot.findUnique({where:{orderId}});
   if(purchase)await recognizeQualificationPackage(tx,orderId,event.correlationId);
   else if(event.eventType==='PACKAGE_PAYMENT_CONFIRMED')throw new Error('PACKAGE_PURCHASE_REQUIRED');
  }
  else if(event.eventType==='PACKAGE_PAYMENT_CONFIRMED')throw new Error('PACKAGE_ORDER_REQUIRED');
  await tx.outboxEvent.update({where:{outboxEventId:lease.outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date()}});
 });
}
