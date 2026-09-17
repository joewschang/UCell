import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { createHash } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { ANALYTICS_POLICY, buildNasl, buildSonar, DAY, Sonar } from './analytics.policy';
import { captureAnalyticsFacts } from './analytics.source';
import { cohortRetention, HistoryInput, historyRange } from './analytics.history';
import { captureVolumeProjection } from './analytics.volume';

type Payload={nasl:ReturnType<typeof buildNasl>;sonar:{sponsor:Sonar;binary:Sonar}|null;volumes?:Awaited<ReturnType<typeof captureVolumeProjection>>|null;issues:string[];comparisonAsOf:string|null;policy:typeof ANALYTICS_POLICY};
type Snapshot={snapshot_id:string;actor_key:string;scope_key:string;as_of:Date;policy_version:string;source_hash:string;payload:Payload};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requireUuid(value:string){if(!uuid.test(value))throw new BadRequestException('VALID_UUID_REQUIRED');return value;}
export function freshness(asOf:Date,now=new Date()) {
  const lagSeconds=Math.max(0,Math.floor((now.getTime()-asOf.getTime())/1000));
  return {status:lagSeconds>ANALYTICS_POLICY.freshnessSeconds?'STALE':'AVAILABLE',lagSeconds};
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma:PrismaService,private readonly audit:AuditService){}
  private metadata(row:Snapshot){return {snapshotId:row.snapshot_id,asOf:row.as_of.toISOString(),policyVersion:row.policy_version,
    projectionVersion:row.payload.policy?.projectionVersion??'analytics-v1',...freshness(row.as_of),issues:row.payload.issues,comparisonAsOf:row.payload.comparisonAsOf};}
  private async latest(scope?:string):Promise<Snapshot|undefined>{
    const rows=scope===undefined
      ?await this.prisma.$queryRaw<Snapshot[]>`SELECT * FROM integration.management_analytics_snapshot WHERE policy_version=${ANALYTICS_POLICY.version} ORDER BY as_of DESC,snapshot_id DESC LIMIT 1`
      :await this.prisma.$queryRaw<Snapshot[]>`SELECT * FROM integration.management_analytics_snapshot WHERE scope_key=${scope} AND policy_version=${ANALYTICS_POLICY.version} ORDER BY as_of DESC,snapshot_id DESC LIMIT 1`;
    return rows[0];
  }
  async overview(){const row=await this.latest();return row?{...this.metadata(row),scope:'ALL_COMPANY_PERSONS',...row.payload.nasl.summary,policy:row.payload.policy}
    :{status:'UNAVAILABLE',reason:'PROJECTION_NOT_BUILT',asOf:null,policy:ANALYTICS_POLICY};}
  async roots(q?:string){
    if(q&&!/^\d{1,18}$/.test(q))throw new BadRequestException('QUALIFICATION_NUMBER_REQUIRED');
    const rows=await this.prisma.qualification.findMany({where:q?{qualificationNo:BigInt(q)}:{},take:30,orderBy:{qualificationNo:'asc'},select:{qualificationId:true,qualificationNo:true}});
    return rows.map(row=>({id:row.qualificationId,label:`Q#${row.qualificationNo}`}));
  }
  async sonar(tree:'sponsor'|'binary',root:string){requireUuid(root);const row=await this.latest(root);
    if(!row?.payload.sonar)return {status:'UNAVAILABLE',reason:'ROOT_PROJECTION_NOT_BUILT',root,tree};
    const report=row.payload.sonar[tree];
    // Contributor identities are available only through the bounded, privileged drilldown.
    const strip=(g:Sonar['total'])=>{const {qualificationIds,...safe}=g;return safe;};
    return {...this.metadata(row),...report,total:strip(report.total),generations:report.generations.map(strip),left:report.left?strip(report.left):null,right:report.right?strip(report.right):null};
  }
  async drilldown(tree:'sponsor'|'binary',root:string,generation:number){
    requireUuid(root);if(!Number.isInteger(generation)||generation<1||generation>12)throw new BadRequestException('GENERATION_1_TO_12_REQUIRED');
    const row=await this.latest(root);if(!row?.payload.sonar)throw new NotFoundException('ROOT_PROJECTION_NOT_BUILT');
    const ids=row.payload.sonar[tree].generations[generation-1].qualificationIds;
    return {...this.metadata(row),generation,total:ids.length,qualificationIds:ids.slice(0,100),truncated:ids.length>100};
  }
  async volumes(tree:'sponsor'|'binary',root:string){
    requireUuid(root);const row=await this.latest(root);
    if(!row?.payload.volumes)return {status:'UNAVAILABLE',reason:'VOLUME_PROJECTION_NOT_BUILT',root,tree};
    const {sponsor,binary,carry,...report}=row.payload.volumes;
    return {...this.metadata(row),...report,freshness:this.metadata(row).status,root,tree,volumes:tree==='sponsor'?sponsor:binary,carry:tree==='binary'?carry:null};
  }
  async history(input:HistoryInput={}){
    const range=historyRange(input);
    const rows=await this.prisma.$queryRaw<Snapshot[]>`
      SELECT snapshot_id,as_of,policy_version,jsonb_build_object('nasl',jsonb_build_object('summary',payload#>'{nasl,summary}'),'issues',payload->'issues','comparisonAsOf',payload->'comparisonAsOf','policy',payload->'policy') AS payload
      FROM (SELECT DISTINCT ON ((as_of AT TIME ZONE 'Asia/Taipei')::date) snapshot_id,as_of,policy_version,payload
      FROM integration.management_analytics_snapshot WHERE as_of>=${range.from} AND as_of<${range.to} AND policy_version=${range.policyVersion}
      ORDER BY (as_of AT TIME ZONE 'Asia/Taipei')::date DESC,as_of DESC,snapshot_id DESC) daily ORDER BY as_of DESC LIMIT 366`;
    return {policyVersion:range.policyVersion,from:range.fromDate,toExclusive:range.toDateExclusive,timezone:range.timezone,rows:rows.reverse().map(row=>({...this.metadata(row),...row.payload.nasl.summary})),
      basis:'CAPTURED_SNAPSHOTS_ONLY_NO_SYNTHETIC_BACKFILL'};
  }
  async cohorts(input:HistoryInput={}){
    const range=historyRange(input),now=new Date();
    const rows=await this.prisma.$queryRaw<Array<{as_of:Date;policy_version:string;states:Record<string,import('./analytics.policy').PersonState>}>>`
      SELECT DISTINCT ON (date_trunc('month',as_of AT TIME ZONE 'Asia/Taipei')) as_of,policy_version,payload#>'{nasl,states}' AS states
      FROM integration.management_analytics_snapshot
      WHERE as_of>=${range.from} AND as_of<${range.to} AND as_of<=${now} AND policy_version=${range.policyVersion}
        AND (as_of AT TIME ZONE 'Asia/Taipei')::date=(date_trunc('month',as_of AT TIME ZONE 'Asia/Taipei')+interval '1 month - 1 day')::date
      ORDER BY date_trunc('month',as_of AT TIME ZONE 'Asia/Taipei'),as_of DESC,snapshot_id DESC LIMIT 13`;
    return cohortRetention(rows.map(r=>({asOf:r.as_of.toISOString(),policyVersion:r.policy_version,states:r.states})),range,now);
  }
  async policyVersions(){
    const rows=await this.prisma.$queryRaw<Array<{policy_version:string}>>`SELECT DISTINCT policy_version FROM integration.management_analytics_snapshot ORDER BY policy_version DESC LIMIT 30`;
    return [...new Set([ANALYTICS_POLICY.version,...rows.map(r=>r.policy_version)])];
  }
  async scopeFreshness(scopes:string[]){
    const rows=await this.prisma.$queryRaw<Array<{scope_key:string;as_of:Date}>>`SELECT DISTINCT ON(scope_key) scope_key,as_of FROM integration.management_analytics_snapshot
      WHERE scope_key IN (${Prisma.join(scopes)}) AND policy_version=${ANALYTICS_POLICY.version} ORDER BY scope_key,as_of DESC`;
    return scopes.map(scope=>{const row=rows.find(r=>r.scope_key===scope);return row?{scope,asOf:row.as_of.toISOString(),...freshness(row.as_of)}:{scope,asOf:null,status:'UNAVAILABLE',lagSeconds:null};});
  }
  async rebuild(id:string,root:string|undefined,actorKey:string,actorId?:string){
    requireUuid(id);if(root)requireUuid(root);const scope=root??'GLOBAL';
    return this.prisma.$transaction(async tx=>{
      // Serialize projector writers. Return promptly when another rebuild owns the lock.
      const [lock]=await tx.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(19670919,1301) AS locked`;
      if(!lock.locked)throw new ConflictException('ANALYTICS_REBUILD_IN_PROGRESS');
      const existing=await tx.$queryRaw<Snapshot[]>`SELECT * FROM integration.management_analytics_snapshot WHERE snapshot_id=${id}::uuid`;
      if(existing[0]){
        if(existing[0].scope_key!==scope||existing[0].actor_key!==actorKey)throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
        return {snapshotId:id,asOf:existing[0].as_of.toISOString(),replayed:true};
      }
      const [clock]=await tx.$queryRaw<Array<{at:Date}>>`SELECT transaction_timestamp() AS at`;
      const at=clock.at, previous=(await tx.$queryRaw<Snapshot[]>`SELECT * FROM integration.management_analytics_snapshot WHERE policy_version=${ANALYTICS_POLICY.version} ORDER BY as_of DESC,snapshot_id DESC LIMIT 1`)[0];
      const facts=await captureAnalyticsFacts(tx,at);
      if(root&&!facts.qualifications.some(q=>q.id===root))throw new NotFoundException('QUALIFICATION_NOT_FOUND');
      const nasl=buildNasl(facts,at.toISOString(),previous?.payload.nasl.states);
      let sonar:Payload['sonar']=null;
      if(root){
        const before=new Date(at.getTime()-30*DAY),after=new Date(at.getTime()-31*DAY);
        const baseline=(await tx.$queryRaw<Snapshot[]>`SELECT * FROM integration.management_analytics_snapshot WHERE scope_key=${scope} AND policy_version=${ANALYTICS_POLICY.version} AND as_of<=${before} AND as_of>=${after} ORDER BY as_of DESC LIMIT 1`)[0];
        try{sonar={sponsor:buildSonar(root,'sponsor',facts,nasl.states,at.toISOString(),baseline?.payload.sonar?.sponsor.total),binary:buildSonar(root,'binary',facts,nasl.states,at.toISOString(),baseline?.payload.sonar?.binary.total)};}
        catch(error){throw new ServiceUnavailableException(error instanceof Error?error.message:'SONAR_PROJECTION_FAILED');}
      }
      const volumes=root?await captureVolumeProjection(tx,root,at):null;
      const sourceHash=createHash('sha256').update(JSON.stringify({facts,volumes,asOf:at.toISOString(),policy:ANALYTICS_POLICY})).digest('hex');
      const payload:Payload={nasl,sonar,volumes,issues:facts.issues,comparisonAsOf:previous?.as_of.toISOString()??null,policy:ANALYTICS_POLICY};
      await tx.$executeRaw`INSERT INTO integration.management_analytics_snapshot(snapshot_id,actor_key,scope_key,as_of,policy_version,source_hash,payload)
        VALUES(${id}::uuid,${actorKey},${scope},${at},${ANALYTICS_POLICY.version},${sourceHash},${JSON.stringify(payload)}::jsonb)`;
      await this.audit.write(tx,{actorType:actorId?'USER':'SYSTEM',actorId,action:'MANAGEMENT_ANALYTICS_PROJECTED',entityType:'ANALYTICS_SNAPSHOT',entityId:id,
        afterData:{scope,sourceHash,policyVersion:ANALYTICS_POLICY.version},requestId:id,correlationId:id});
      return {snapshotId:id,asOf:at.toISOString(),replayed:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:60_000});
  }
}
