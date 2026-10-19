import {Prisma} from '@prisma/client';

export const qualificationReturnReviewPolicy='PO_20261019_PREPLACEMENT_RETURN_REVIEW';
export const unplacedReturnStates=['BALL_SETUP_PENDING','PLACEMENT_PENDING','PLACEMENT_OVERDUE','RETURN_REVIEW_PENDING'];

/** Immutable return acceptance, not the user-supplied economic date, distinguishes
 * goods returned before the first GPV recognition from subsequent recoveries. */
export async function preplacementReturnedGpv(tx:Prisma.TransactionClient,orderId:string){
 const accepted=await tx.auditEvent.findMany({where:{action:'QUALIFICATION_PREPLACEMENT_RETURN_ACCEPTED',afterData:{path:['orderId'],equals:orderId}},select:{entityId:true}});
 const ids=accepted.map(x=>x.entityId).filter((x):x is string=>!!x);
 const rows=ids.length?await tx.returnLine.findMany({where:{returnCaseId:{in:ids}}}):[];
 const byLine=new Map<string,Prisma.Decimal>();
 for(const row of rows)byLine.set(row.orderLineId,(byLine.get(row.orderLineId)??new Prisma.Decimal(0)).add(row.gpvReversalAmount));
 return byLine;
}

export async function acceptQualificationPreplacementReturn(tx:Prisma.TransactionClient,input:{qualificationId:string;orderId:string;returnCaseId:string;fullReturn:boolean;remainingAmount:Prisma.Decimal;correlationId:string;actorId?:string;requestId:string}){
 const setup=await tx.qualificationSetup.findUniqueOrThrow({where:{qualificationId:input.qualificationId}});
 if(setup.qualifyingOrderId!==input.orderId||setup.placedAt||!unplacedReturnStates.includes(setup.setupStatus))throw new Error('QUALIFICATION_RETURN_PLACEMENT_CONFLICT');
 await tx.qualificationSetup.update({where:{qualificationId:input.qualificationId},data:{setupStatus:input.fullReturn?'REVERSED':'RETURN_REVIEW_PENDING',placementRequestedAt:null,placementDueAt:null}});
 await tx.auditEvent.create({data:{actorType:input.actorId?'USER':'SYSTEM',actorId:input.actorId,action:'QUALIFICATION_PREPLACEMENT_RETURN_ACCEPTED',entityType:'RETURN',entityId:input.returnCaseId,requestId:input.requestId,correlationId:input.correlationId,afterData:{orderId:input.orderId,qualificationId:input.qualificationId,fullReturn:input.fullReturn,remainingAmount:input.remainingAmount.toString(),policy:qualificationReturnReviewPolicy}}});
 if(input.fullReturn){
  // Revoke only the mutable package projection. Original entitlement evidence is retained.
  const periods=await tx.activePeriod.findMany({where:{qualificationId:input.qualificationId,sourceType:'QUALIFICATION_PACKAGE',sourceId:setup.packagePurchaseSnapshotId!}});
  for(const period of periods)await tx.activePeriod.updateMany({where:{qualificationId:input.qualificationId,sourceType:'QUALIFICATION_PACKAGE',sourceId:setup.packagePurchaseSnapshotId!,activeFrom:period.activeFrom},data:{activeTo:period.activeFrom}});
  const now=new Date(),active=await tx.activePeriod.count({where:{qualificationId:input.qualificationId,activeFrom:{lte:now},OR:[{activeTo:null},{activeTo:{gt:now}}]}});
  await tx.qualification.update({where:{qualificationId:input.qualificationId},data:{activeFlag:active>0}});
 }
}
