import {Prisma,verifyErpBusinessProjection} from '@ucell/database';

/** ERP is an independent checkpoint; a sealed review is not a posted voucher. */
export async function compensationErpEvidence(tx:Prisma.TransactionClient,periodReference:string,current:{payable:Prisma.Decimal;recoveryRequired:Prisma.Decimal;recoveryApplied:Prisma.Decimal;recoveryOutstanding:Prisma.Decimal}){
 const row=await tx.erpBusinessProjection.findFirst({where:{stream:'COMPENSATION',sourceIdentity:periodReference},orderBy:{revision:'desc'},include:{outboxEvent:true,externalReference:true,reconciliations:{orderBy:[{recordedAt:'desc'},{reconciliationId:'desc'}],take:1}}});
 if(!row)return {projectionReference:null,status:'BLOCKED_EXTERNAL',state:'NOT_CREATED',code:'ERP_ACCOUNT_MAPPING_REQUIRED',memberPayableGross:null,currency:null,payloadHash:null,drillbackHash:null,sourceChanged:false};
 const projectionReference=row.projectionReference;
 try{
  const payload=verifyErpBusinessProjection(row);
  if(payload.projectionPurpose!=='SUBLEDGER_ACCOUNTING_REVIEW'||payload.periodReference!==periodReference)throw new Error('UNSUPPORTED_PROJECTION');
  const totals=payload.totals,sourceChanged=!current.payable.eq(totals.memberPayableGross)||!current.recoveryRequired.eq(totals.recoveryRequired)||!current.recoveryApplied.eq(totals.recoveryApplied)||!current.recoveryOutstanding.eq(totals.recoveryOutstanding),latest=row.reconciliations[0];
  const status=sourceChanged?'ATTENTION':!row.mappingReference?'BLOCKED_EXTERNAL':row.outboxEvent.processStatus==='DEAD'?'FAILED':latest?.outcome==='MATCHED'?'PASS':latest?'ATTENTION':'PENDING';
  return {projectionReference,status,state:sourceChanged?'SUPPLEMENT_REQUIRED':!row.mappingReference?'SEALED_MAPPING_REQUIRED':latest?.outcome==='MATCHED'?'RECONCILED':'AWAITING_ERP_EVIDENCE',code:sourceChanged?'ERP_COMPENSATION_SOURCE_CHANGED':!row.mappingReference?'ERP_ACCOUNT_MAPPING_REQUIRED':null,memberPayableGross:new Prisma.Decimal(totals.memberPayableGross).toFixed(4),currency:payload.currency,payloadHash:row.payloadHash,drillbackHash:row.drillbackHash,sourceChanged};
 }catch{return {projectionReference,status:'FAILED',state:'EVIDENCE_INVALID',code:'ERP_PROJECTION_INTEGRITY_INVALID',memberPayableGross:null,currency:null,payloadHash:null,drillbackHash:null,sourceChanged:false};}
}
