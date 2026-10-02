import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,erpBusinessReference,replayHash} from '@ucell/database';
type Scope='PAYOUT'|'PAYABLE'|'RECOVERY';
export const FINANCIAL_WORK_SOURCES={PAYOUT_BATCH:'PAYOUT',PAYABLE_ENTRY:'PAYABLE',BONUS_RECOVERY:'RECOVERY'} as const;
export const FINANCIAL_CANDIDATE_CODES=['PAYOUT_BATCH_TOTAL_MISMATCH','PAYOUT_LINE_SOURCE_MISMATCH','BANK_RESULT_FAILED','BANK_RESULT_INCOMPLETE','BANK_PAID_EVIDENCE_MISSING','PAYABLE_SOURCE_TYPE_UNSUPPORTED','PAYABLE_SOURCE_MISSING','PAYABLE_SOURCE_MISMATCH','PAYABLE_MATURITY_EVIDENCE_MISSING','PAYABLE_PAYOUT_LINK_MISMATCH','RECOVERY_BALANCE_MISMATCH','RECOVERY_OUTSTANDING'];
export function financialWorkReference(sourceType:string,sourceId:string){
 const scope=FINANCIAL_WORK_SOURCES[sourceType as keyof typeof FINANCIAL_WORK_SOURCES];
 if(!scope)return null;
 if(new RegExp(`^${scope}-(?:[a-f0-9]{40}|[a-f0-9]{20})$`).test(sourceId))return {scope,reference:sourceId};
 return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sourceId)?{scope,reference:erpBusinessReference(scope,sourceId)}:null;
}
const tables={PAYOUT:['payout_batch','payout_batch_id'],PAYABLE:['payable_entry','payable_entry_id'],RECOVERY:['bonus_recovery_event','bonus_recovery_event_id']} as const;
const amount=(value:any)=>new Prisma.Decimal(value??0).toFixed(4);
const sum=(rows:any[],key:string)=>rows.reduce((total,row)=>total.add(row[key]),new Prisma.Decimal(0));
const ref=(scope:string,id:string)=>erpBusinessReference(scope,id);
@Injectable()
export class OperationsFinancialHealthService{
 constructor(private readonly db:PrismaService){}
 async resolve(tx:Prisma.TransactionClient,scope:Scope,reference:string){
  if(!new RegExp(`^${scope}-(?:[a-f0-9]{40}|[a-f0-9]{20})$`).test(reference))throw new UnprocessableEntityException({code:'OPERATIONS_FINANCIAL_REFERENCE_INVALID'});
  const [table,column]=tables[scope],legacy=reference.length===scope.length+21;
  const hash=legacy?Prisma.sql`substr(encode(sha256(convert_to(${scope+':'} || ${Prisma.raw(column)}::text,'UTF8')),'hex'),1,20)`:Prisma.sql`substr(encode(sha256(convert_to('{"id":"' || ${Prisma.raw(column)}::text || '","kind":"' || ${scope} || '"}','UTF8')),'hex'),1,40)`;
  const rows=await tx.$queryRaw<{id:string;createdAt:Date}[]>`SELECT ${Prisma.raw(column)} AS id,created_at AS "createdAt" FROM ledger.${Prisma.raw(table)} WHERE ${scope+'-'} || ${hash}=${reference} LIMIT 2`;
  if(rows.length!==1)throw new ConflictException({code:'OPERATIONS_FINANCIAL_SOURCE_NOT_FOUND'});return rows[0];
 }
 async list(input:{scope:string;take?:number;cursor?:string;asOf?:string;reference?:string}){
  if(!Object.hasOwn(tables,input.scope))throw new UnprocessableEntityException({code:'OPERATIONS_FINANCIAL_SCOPE_INVALID'});
  const scope=input.scope as Scope,take=input.take??25,asOf=input.asOf?new Date(input.asOf):new Date();if(!Number.isInteger(take)||take<1||take>100||!Number.isFinite(asOf.getTime())||input.cursor&&input.reference)throw new UnprocessableEntityException({code:'OPERATIONS_FINANCIAL_QUERY_INVALID'});
  return this.db.$transaction(async tx=>{
   const cursor=input.cursor?await this.resolve(tx,scope,input.cursor):null,selected=input.reference?await this.resolve(tx,scope,input.reference):null,idField=scope==='PAYOUT'?'payoutBatchId':scope==='PAYABLE'?'payableEntryId':'bonusRecoveryEventId';
   const where={createdAt:{lte:asOf},...(selected?{[idField]:selected.id}:{}),...(cursor?{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,[idField]:{lt:cursor.id}}]}:{})},args={where,orderBy:[{createdAt:'desc'},{[idField]:'desc'}] as any,take:take+1};
   const rows:any[]=scope==='PAYOUT'?await tx.payoutBatch.findMany(args):scope==='PAYABLE'?await tx.payableEntry.findMany(args):await tx.bonusRecoveryEvent.findMany(args);
   const page=rows.slice(0,take),items=scope==='PAYOUT'?await this.payouts(tx,page):scope==='PAYABLE'?await this.payables(tx,page):await this.recoveries(tx,page);
   return {scope,items,observed:items.length,coverage:'CURRENT_PAGE_ONLY',counts:{attention:items.filter(row=>row.candidates.length).length,bankFailedLines:items.reduce((n,row)=>n+(row.evidence.bankFailedLines??0),0),bankUnreconciledLines:items.reduce((n,row)=>n+(row.evidence.bankUnreconciledLines??0),0)},recoveryOutstanding:sum(page.filter(()=>scope==='RECOVERY'),'outstandingAmount').toFixed(4),nextCursor:rows.length>take?items.at(-1)!.reference:null,asOf:asOf.toISOString(),dataThrough:new Date().toISOString()};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
 }
 private item(scope:Scope,row:any,evidence:Record<string,any>,codes:string[]){
  const id=scope==='PAYOUT'?row.payoutBatchId:scope==='PAYABLE'?row.payableEntryId:row.bonusRecoveryEventId,reference=ref(scope,id),link=`/operations-control?scope=${scope}&reference=${reference}`;
  return {reference,scope,status:row.status,createdAt:row.createdAt.toISOString(),evidence,link,actionLink:scope==='PAYOUT'?`/payouts?reference=${reference}`:evidence.payoutReference?`/payouts?reference=${evidence.payoutReference}`:null,candidates:[...new Set(codes)].map(code=>({code,severity:code==='BANK_RESULT_INCOMPLETE'||code==='RECOVERY_OUTSTANDING'?'HIGH':'CRITICAL',reference,evidenceHash:replayHash({reference,code,status:row.status,evidence}),link}))};
 }
 private async payouts(tx:Prisma.TransactionClient,rows:any[]){
  if(!rows.length)return [];
  // Aggregate each complete selected batch in SQL: child history does not expand the API page.
  const facts=await tx.$queryRaw<any[]>`SELECT l.payout_batch_id AS id,count(*)::integer AS "lineCount",sum(l.gross_amount)::text AS gross,sum(l.recovery_offset)::text AS recovery,sum(l.net_amount)::text AS net,
   sum(coalesce(p.paid,0))::text AS paid,
   count(*) FILTER (WHERE coalesce(p.confirmations,0)=0 OR coalesce(p.paid,0)<>l.net_amount)::integer AS incomplete,
   count(*) FILTER (WHERE latest.result_status='FAILED' AND (coalesce(p.confirmations,0)=0 OR coalesce(p.paid,0)<>l.net_amount))::integer AS failed,
   count(*) FILTER (WHERE coalesce(s.gross,0)<>l.gross_amount OR coalesce(s.foreign_recipient,0)>0 OR coalesce(a.applied,0)<>l.recovery_offset OR l.gross_amount-l.recovery_offset<>l.net_amount OR coalesce(p.paid,0)>l.net_amount)::integer AS broken,
   count(*) FILTER (WHERE coalesce(s.paid_entries,0)>0 AND (coalesce(p.confirmations,0)=0 OR coalesce(p.paid,0)<>l.net_amount))::integer AS "paidWithoutProof"
   FROM ledger.payout_line l
   LEFT JOIN LATERAL (SELECT max(r.paid_amount) AS paid,count(*) AS confirmations FROM ledger.payout_payment_result r WHERE r.payout_line_id=l.payout_line_id AND r.payout_batch_id=l.payout_batch_id AND r.result_status='PAID') p ON true
   LEFT JOIN LATERAL (SELECT r.result_status FROM ledger.payout_payment_result r WHERE r.payout_line_id=l.payout_line_id AND r.payout_batch_id=l.payout_batch_id ORDER BY r.created_at DESC,r.payout_payment_result_id DESC LIMIT 1) latest ON true
   LEFT JOIN LATERAL (SELECT sum(e.gross_amount) AS gross,count(*) FILTER (WHERE e.qualification_id<>l.recipient_qualification_id) AS foreign_recipient,count(*) FILTER (WHERE e.status='PAID') AS paid_entries FROM ledger.payable_entry e WHERE e.payout_line_id=l.payout_line_id) s ON true
   LEFT JOIN LATERAL (SELECT sum(a.amount) AS applied FROM ledger.recovery_application a WHERE a.payout_line_id=l.payout_line_id) a ON true
   WHERE l.payout_batch_id IN (${Prisma.join(rows.map(row=>Prisma.sql`${row.payoutBatchId}::uuid`))}) GROUP BY l.payout_batch_id`;
  return rows.map(row=>{const fact=facts.find(item=>item.id===row.payoutBatchId)??{},count=fact.lineCount??0,bankStage=!!row.exportedAt||['EXPORTED','PROCESSING','PARTIALLY_PAID','FAILED','PAID'].includes(row.status),incomplete=bankStage?(fact.incomplete??0):0,codes:string[]=[];
   if(!row.totalGross.eq(fact.gross??0)||!row.totalRecovery.eq(fact.recovery??0)||!row.totalNet.eq(fact.net??0))codes.push('PAYOUT_BATCH_TOTAL_MISMATCH');if(fact.broken)codes.push('PAYOUT_LINE_SOURCE_MISMATCH');if(fact.failed)codes.push('BANK_RESULT_FAILED');if(incomplete)codes.push('BANK_RESULT_INCOMPLETE');if(fact.paidWithoutProof||row.status==='PAID'&&(!count||fact.incomplete))codes.push('BANK_PAID_EVIDENCE_MISSING');
   return this.item('PAYOUT',row,{periodStart:row.periodStart.toISOString(),periodEnd:row.periodEnd.toISOString(),totalGross:amount(row.totalGross),totalRecovery:amount(row.totalRecovery),totalNet:amount(row.totalNet),lineGross:amount(fact.gross),lineRecovery:amount(fact.recovery),lineNet:amount(fact.net),bankConfirmed:amount(fact.paid),lineCount:count,bankFailedLines:fact.failed??0,bankUnreconciledLines:incomplete,bankStage,brokenLineCount:fact.broken??0,amountScope:'WHOLE_PAYOUT_BATCH'},codes);
  });
 }
 private async payables(tx:Prisma.TransactionClient,rows:any[]){
  const ids=(type:string)=>rows.filter(row=>row.sourceType===type).map(row=>row.sourceId);
  const [bonuses,rpvs,globals,lines]=await Promise.all([
   tx.bonusAward.findMany({where:{bonusAwardId:{in:ids('BONUS_AWARD')}},include:{economicDestination:true,lifecycleEvents:true}}),
   tx.rpvUplineAwardEvent.findMany({where:{rpvAwardEventId:{in:ids('RPV_UPLINE_AWARD')}},include:{economicDestination:true}}),
   tx.globalPoolAward.findMany({where:{globalPoolAwardId:{in:ids('GLOBAL_POOL_AWARD')}},include:{economicDestination:true,settlement:{select:{ruleVersionCode:true,periodEnd:true}}}}),
   tx.payoutLine.findMany({where:{payoutLineId:{in:rows.flatMap(row=>row.payoutLineId?[row.payoutLineId]:[])}},select:{payoutLineId:true,payoutBatchId:true,recipientQualificationId:true}}),
  ]);
  return rows.map(row=>{
   const source:any=row.sourceType==='BONUS_AWARD'?bonuses.find(item=>item.bonusAwardId===row.sourceId):row.sourceType==='RPV_UPLINE_AWARD'?rpvs.find(item=>item.rpvAwardEventId===row.sourceId):row.sourceType==='GLOBAL_POOL_AWARD'?globals.find(item=>item.globalPoolAwardId===row.sourceId):null,known=['BONUS_AWARD','RPV_UPLINE_AWARD','GLOBAL_POOL_AWARD'].includes(row.sourceType),codes:string[]=[];
   const line=lines.find(item=>item.payoutLineId===row.payoutLineId),sourceRule=source?.ruleVersionCode??source?.settlement?.ruleVersionCode;
   if(!known)codes.push('PAYABLE_SOURCE_TYPE_UNSUPPORTED');else if(!source)codes.push('PAYABLE_SOURCE_MISSING');
   else{
    const awardType=row.sourceType==='BONUS_AWARD'?source.awardType:row.sourceType==='RPV_UPLINE_AWARD'?'RPV':'GLOBAL',availableAt=source.pendingUntil??source.occurredAt??source.settlement?.periodEnd;
    if(source.economicDestination||!source.payableAmount.gt(0)||!source.payableAmount.eq(row.grossAmount)||(source.recipientQualificationId??source.qualificationId)!==row.qualificationId||sourceRule!==row.ruleVersionCode||awardType!==row.awardType)codes.push('PAYABLE_SOURCE_MISMATCH');
    if(availableAt>row.availableAt||row.sourceType==='BONUS_AWARD'&&!source.lifecycleEvents.some((event:any)=>event.status==='EFFECTIVE'))codes.push('PAYABLE_MATURITY_EVIDENCE_MISSING');
   }
   if(row.payoutLineId&&(!line||line.recipientQualificationId!==row.qualificationId)||['BATCHED','PAID'].includes(row.status)&&!row.payoutLineId)codes.push('PAYABLE_PAYOUT_LINK_MISMATCH');
   return this.item('PAYABLE',row,{sourceType:known?row.sourceType:'UNSUPPORTED',sourceReference:known?ref('AWARD-SOURCE',row.sourceType+':'+row.sourceId):null,grossAmount:amount(row.grossAmount),sourceAmount:source?amount(source.payableAmount):null,ruleVersionCode:row.ruleVersionCode,sourceRuleVersionCode:sourceRule??null,availableAt:row.availableAt.toISOString(),sourceExists:!!source,companyDestination:!!source?.economicDestination,payoutReference:line?ref('PAYOUT',line.payoutBatchId):null},codes);
  });
 }
 private async recoveries(tx:Prisma.TransactionClient,rows:any[]){
  const applications=await tx.recoveryApplication.groupBy({by:['bonusRecoveryEventId'],where:{bonusRecoveryEventId:{in:rows.map(row=>row.bonusRecoveryEventId)}},_sum:{amount:true},_count:true});
  return rows.map(row=>{const applied=applications.find(item=>item.bonusRecoveryEventId===row.bonusRecoveryEventId),total=applied?._sum.amount??new Prisma.Decimal(0),codes:string[]=[];
   if(!total.eq(row.recoveredAmount)||!row.recoveryAmount.eq(total.add(row.outstandingAmount))||row.outstandingAmount.lt(0))codes.push('RECOVERY_BALANCE_MISMATCH');if(row.outstandingAmount.gt(0))codes.push('RECOVERY_OUTSTANDING');
   return this.item('RECOVERY',row,{recoveryRequired:amount(row.recoveryAmount),recoveryApplied:amount(total),recoveryOutstanding:amount(row.outstandingAmount),applicationCount:applied?._count??0,occurredAt:row.occurredAt.toISOString()},codes);
  });
 }
}
