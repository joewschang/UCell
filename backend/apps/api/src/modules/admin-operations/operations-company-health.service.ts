import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,erpBusinessReference,replayHash} from '@ucell/database';
import {companyReservoirCandidates} from './company-reservoir-invariants';
const config={COMPANY_BONUS:{table:'bonus_award',column:'bonus_award_id',field:'bonusAwardId',kind:'COMPANY-BONUS',source:'BONUS_AWARD'},COMPANY_RPV:{table:'rpv_upline_award_event',column:'rpv_award_event_id',field:'rpvAwardEventId',kind:'COMPANY-RPV',source:'RPV_AWARD'},COMPANY_GLOBAL:{table:'global_pool_award',column:'global_pool_award_id',field:'globalPoolAwardId',kind:'COMPANY-GLOBAL',source:'GLOBAL_AWARD'}} as const;
type Scope=keyof typeof config;
export const COMPANY_WORK_SOURCES={COMPANY_BONUS_AWARD:'COMPANY_BONUS',COMPANY_RPV_AWARD:'COMPANY_RPV',COMPANY_GLOBAL_AWARD:'COMPANY_GLOBAL'} as const;
export const COMPANY_CODES=['COMPANY_AWARD_DESTINATION_MISSING','RESERVOIR_B_ENTITLEMENT_MISMATCH','RESERVOIR_B_REPLAY_MISMATCH','RESERVOIR_B_MEMBER_PAYABLE_CONFLICT'];
export function companyWorkReference(sourceType:string,id:string){const scope=COMPANY_WORK_SOURCES[sourceType as keyof typeof COMPANY_WORK_SOURCES];if(!scope)return null;const kind=config[scope].kind;if(new RegExp(`^${kind}-[a-f0-9]{40}$`).test(id))return {scope,reference:id};return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)?{scope,reference:erpBusinessReference(kind,id)}:null;}
const sum=(rows:any[])=>rows.reduce((value,row)=>value.add(row.amountDelta),new Prisma.Decimal(0));
@Injectable()
export class OperationsCompanyHealthService{
 constructor(private readonly db:PrismaService){}
 async resolve(tx:Prisma.TransactionClient,scope:Scope,reference:string){
  const type=config[scope];if(!new RegExp(`^${type.kind}-[a-f0-9]{40}$`).test(reference))throw new UnprocessableEntityException({code:'OPERATIONS_COMPANY_REFERENCE_INVALID'});
  const column=Prisma.raw(type.column),rows=await tx.$queryRaw<{id:string;createdAt:Date}[]>`SELECT ${column} AS id,created_at AS "createdAt" FROM ledger.${Prisma.raw(type.table)} WHERE ${type.kind+'-'} || substr(encode(sha256(convert_to('{"id":"' || ${column}::text || '","kind":"' || ${type.kind} || '"}','UTF8')),'hex'),1,40)=${reference} LIMIT 2`;
  if(rows.length!==1)throw new ConflictException({code:'OPERATIONS_COMPANY_SOURCE_NOT_FOUND'});return rows[0];
 }
 async list(input:{scope:string;take?:number;cursor?:string;asOf?:string;reference?:string}){
  if(!Object.hasOwn(config,input.scope))throw new UnprocessableEntityException({code:'OPERATIONS_COMPANY_SCOPE_INVALID'});const scope=input.scope as Scope,type=config[scope],take=input.take??25,asOf=input.asOf?new Date(input.asOf):new Date();
  if(!Number.isInteger(take)||take<1||take>100||!Number.isFinite(asOf.getTime())||input.cursor&&input.reference)throw new UnprocessableEntityException({code:'OPERATIONS_COMPANY_QUERY_INVALID'});
  return this.db.$transaction(async tx=>{
   const cursor=input.cursor?await this.resolve(tx,scope,input.cursor):null,selected=input.reference?await this.resolve(tx,scope,input.reference):null,where={createdAt:{lte:asOf},...(selected?{[type.field]:selected.id}:{}),...(cursor?{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,[type.field]:{lt:cursor.id}}]}:{})},args={where,include:{economicDestination:{include:{effects:true}}},orderBy:[{createdAt:'desc'},{[type.field]:'desc'}] as any,take:take+1};
   const rows:any[]=scope==='COMPANY_BONUS'?await tx.bonusAward.findMany(args):scope==='COMPANY_RPV'?await tx.rpvUplineAwardEvent.findMany(args):await tx.globalPoolAward.findMany({...args,include:{...args.include,settlement:{select:{periodEnd:true,ruleVersionCode:true}}}}),page=rows.slice(0,take),ids=page.map(row=>row[type.field]);
   const [candidates,qualifications]=await Promise.all([companyReservoirCandidates(tx,take+1,{bonusIds:scope==='COMPANY_BONUS'?ids:[],rpvIds:scope==='COMPANY_RPV'?ids:[],globalIds:scope==='COMPANY_GLOBAL'?ids:[]}),tx.qualification.findMany({where:{qualificationId:{in:page.map(row=>row.recipientQualificationId??row.qualificationId)}},include:{ownerIntervals:true}})]);
   const items=page.map(row=>{
    const id=row[type.field],reference=erpBusinessReference(type.kind,id),destination=row.economicDestination,sourceRefs=[erpBusinessReference(type.source,id),...(destination?[erpBusinessReference('AWARD_ECONOMIC_DESTINATION',destination.destinationId)]:[])],q=qualifications.find(item=>item.qualificationId===(row.recipientQualificationId??row.qualificationId)),at:Date=row.occurredAt??row.settlement.periodEnd;
    const company=q?.kind==='COMPANY_BOOTSTRAP'||q?.ownerIntervals.some(owner=>owner.ownerType==='COMPANY'&&owner.effectiveFrom<=at&&(!owner.effectiveTo||owner.effectiveTo>at))||false,originals=destination?.effects.filter((effect:any)=>effect.effectType==='ENTITLEMENT')??[],adjustments=destination?.effects.filter((effect:any)=>effect.effectType==='REPLAY_ADJUSTMENT')??[],link=`/operations-control?company=${scope}&reference=${reference}`;
    const evidence={qualificationNo:q?.qualificationNo.toString()??null,awardType:row.awardType??(scope==='COMPANY_RPV'?'RPV':'GLOBAL'),historicalCompany:company,occurredAt:at.toISOString(),sourceAmount:row.payableAmount.toFixed(4),ruleVersionCode:row.ruleVersionCode??row.settlement.ruleVersionCode,destinationReference:destination?erpBusinessReference('RESERVOIR-DESTINATION',destination.destinationId):null,destination:destination?'RESERVOIR_B':null,periodStart:destination?.periodStart.toISOString()??null,periodEnd:destination?.periodEnd.toISOString()??null,originalEntitlement:destination?.finalAmount.toFixed(4)??null,originalCredit:sum(originals).toFixed(4),originalEffectCount:originals.length,replayAdjustment:sum(adjustments).toFixed(4),replayEffectCount:adjustments.length,recordedBalance:sum(destination?.effects??[]).toFixed(4)};
    return {reference,scope,link,evidence,candidates:candidates.filter(candidate=>sourceRefs.includes(candidate.sourceReference)).map(candidate=>({reference,code:candidate.code,severity:candidate.severity,detail:candidate.detail,evidenceHash:replayHash({reference,code:candidate.code,evidence,sourceEvidenceHash:candidate.evidenceHash}),link}))};
   });
   return {items,scope,observed:items.length,attention:items.filter(row=>row.candidates.length).length,coverage:'CURRENT_PAGE_ONLY',asOf:asOf.toISOString(),dataThrough:new Date().toISOString(),nextCursor:rows.length>take?items.at(-1)!.reference:null};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
 }
}
