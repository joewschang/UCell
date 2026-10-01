import {BadRequestException,Injectable} from '@nestjs/common';
import {PrismaService,erpBusinessReference,replayHash} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {CompensationPeriodControlService} from './compensation-period-control.service';
type Period={periodStart:string;periodEnd:string;ruleVersionCode:string};
type Observation={observation_id:string;revision:number;previous_stage:string|null;stage:string;source_as_of:Date;observed_at:Date;evidence_hash:string};
function period(input:Period){const start=new Date(input.periodStart),end=new Date(input.periodEnd),rule=input.ruleVersionCode?.trim();if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end||!rule||rule.length>100)throw new BadRequestException({code:'COMPENSATION_STAGE_PERIOD_INVALID'});return {start,end,rule};}
function projection(row:Observation){return {reference:erpBusinessReference('PERIOD-STAGE',row.observation_id),revision:row.revision,previousStage:row.previous_stage,stage:row.stage,sourceAsOf:row.source_as_of.toISOString(),observedAt:row.observed_at.toISOString(),evidenceHash:row.evidence_hash,businessEnteredAt:null,basis:'AUTHORITATIVE_CONTROL_OBSERVATION' as const};}
@Injectable()
export class CompensationStageHistoryService{
 constructor(private readonly db:PrismaService,private readonly control:CompensationPeriodControlService,private readonly audit:AuditService){}
 async refresh(input:Period,context:{actorId:string;actorRole:string;requestId:string;correlationId:string}){
  const identity=period(input);
  // Only the authoritative control reader chooses stage/evidence; callers cannot
  // supply a lifecycle or backdate observations. A later financial change may
  // supersede this observed source snapshot without changing previous history.
  const facts=await this.control.read({periodStart:identity.start.toISOString(),periodEnd:identity.end.toISOString(),ruleVersionCode:identity.rule});
  const hash=replayHash({period:facts.period,lifecycle:facts.lifecycle,checkpoints:facts.checkpoints,amountBridge:facts.amountBridge,reconciliationScope:facts.reconciliationScope,blockingExceptions:facts.blockingExceptions,settlements:facts.settlements,payouts:facts.payouts,jobs:facts.jobs.map(({processTiming,...job})=>job)});
  return this.db.$transaction(async tx=>{
   const [row]=await tx.$queryRaw<Observation[]>`SELECT * FROM integration.ucell_observe_compensation_stage(${identity.start},${identity.end},${identity.rule},${facts.lifecycle},${new Date(facts.dataThrough)},${hash})`;
   const [watermark]=await tx.$queryRaw<Array<{source_as_of:Date}>>`SELECT source_as_of FROM integration.compensation_stage_watermark WHERE period_start=${identity.start} AND period_end=${identity.end} AND rule_version_code=${identity.rule}`;
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,actorRoleSnapshot:context.actorRole,action:'COMPENSATION_STAGE_REFRESHED',entityType:'CompensationStageObservation',entityId:row.observation_id,afterData:{period:facts.period,stage:row.stage,revision:row.revision,evidenceHash:row.evidence_hash,checkedThrough:watermark.source_as_of.toISOString()},requestId:context.requestId,correlationId:context.correlationId});
   return {item:projection(row),checkedThrough:watermark.source_as_of.toISOString(),authority:'Observation only; no payment, settlement or financial-close command' as const};
  });
 }
 async list(input:Period&{take?:number;cursor?:number;asOf?:string}){
  const identity=period(input),take=input.take??25,now=new Date(),asOf=input.asOf?new Date(input.asOf):now;
  if(!Number.isInteger(take)||take<1||take>100||input.cursor!==undefined&&(!Number.isInteger(input.cursor)||input.cursor<1||input.cursor>2147483647)||!Number.isFinite(asOf.getTime())||asOf>now)throw new BadRequestException({code:'COMPENSATION_STAGE_HISTORY_QUERY_INVALID'});
  const rows=await this.db.$queryRaw<Observation[]>`SELECT * FROM integration.compensation_stage_observation WHERE period_start=${identity.start} AND period_end=${identity.end} AND rule_version_code=${identity.rule} AND observed_at<=${asOf} AND (${input.cursor??null}::integer IS NULL OR revision<${input.cursor??null}) ORDER BY revision DESC LIMIT ${take+1}`;
  const page=rows.slice(0,take);return {items:page.map(projection),nextCursor:rows.length>take?page[page.length-1].revision:null,asOf:asOf.toISOString(),coverage:'CURRENT_PAGE_ONLY' as const,authority:'Recorded observations do not reconstruct unobserved stages or business entry times' as const};
 }
}
