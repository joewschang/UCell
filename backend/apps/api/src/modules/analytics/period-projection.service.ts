import {Prisma,PrismaService} from '@ucell/database';
import {ConflictException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {createHash,randomUUID} from 'node:crypto';
import {authorizeTreePrincipal,TreePrincipal} from '../binary-tree/tree-authorization';
import {AnalyticsQuery,parseAnalyticsQuery,METRIC_DEFINITIONS} from '@ucell/shared';
import {projectPeriodFacts,projectionGroup} from './period-projection-sources';
export const PERIOD_ROLES=['SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT'];
const canonical=(x:any):any=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const projectionHash=(x:unknown)=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
export const PROJECTION_VERSION='PERIOD_FACTS_V1';
type Job={job_id:string;actor_context:TreePrincipal;query:AnalyticsQuery;query_hash:string;mode:string;lease_token:string};
@Injectable()
export class PeriodProjectionService{
 constructor(private readonly db:PrismaService){}
 private parse(p:TreePrincipal,raw:unknown){
  let query:Readonly<AnalyticsQuery>;
  try{query=parseAnalyticsQuery(raw,{actorId:p.personId!,actorType:'ADMIN',roles:[p.role],permissions:Object.values(METRIC_DEFINITIONS).map(m=>m.requiredPermission),scopes:['ADMIN_ALL'],locale:'zh-TW',timezone:'Asia/Taipei',correlationId:randomUUID(),contextVersion:'1'});}
  catch{throw new UnprocessableEntityException({code:'INVALID_ANALYTICS_QUERY'});}
  if(query.limit>100||query.metrics.length!==1||query.comparison||query.pagination||query.time.asOf>new Date().toISOString()||query.time.knowledgeCutoff>new Date().toISOString())throw new UnprocessableEntityException({code:'UNSUPPORTED_PROJECTION_QUERY'});
  projectionGroup(query);
  return query;
 }
 async request(p:TreePrincipal,raw:unknown,mode:'DRY_RUN'|'REBUILD'|'RECONCILE',key:string){
  await authorizeTreePrincipal(this.db,p,PERIOD_ROLES);
  if(!['DRY_RUN','REBUILD','RECONCILE'].includes(mode)||typeof key!=='string'||!/^[-a-zA-Z0-9_:]{1,128}$/.test(key))throw new UnprocessableEntityException({code:'INVALID_PROJECTION_REQUEST'});
  const query=this.parse(p,raw),hash=projectionHash(query),jobId=randomUUID();
  return this.db.$transaction(async tx=>{
   await authorizeTreePrincipal(this.db,p,PERIOD_ROLES,tx);
   // One actor cannot flood the queue with unbounded outstanding work.
   await tx.$queryRaw`SELECT person_id FROM identity.person WHERE person_id=${p.personId}::uuid FOR UPDATE`;
   const existing=await tx.$queryRaw<any[]>`SELECT job_id,status,query_hash,mode FROM integration.period_projection_job WHERE actor_id=${p.personId}::uuid AND request_key=${key}`;
   if(existing.length){if(existing[0].query_hash!==hash||existing[0].mode!==mode)throw new ConflictException({code:'IDEMPOTENCY_CONFLICT'});return {jobId:existing[0].job_id,status:existing[0].status,replayed:true};}
   const [count]=await tx.$queryRaw<Array<{n:bigint}>>`SELECT count(*) n FROM integration.period_projection_job WHERE actor_id=${p.personId}::uuid AND status IN ('REQUESTED','RUNNING')`;
   if(count.n>=10n)throw new ConflictException({code:'PROJECTION_QUEUE_LIMIT'});
   await tx.$executeRaw`INSERT INTO integration.period_projection_job(job_id,actor_id,actor_context,request_key,query_hash,query,mode)
    VALUES(${jobId}::uuid,${p.personId}::uuid,${JSON.stringify(p)}::jsonb,${key},${hash},${JSON.stringify(query)}::jsonb,${mode})`;
   if(mode==='REBUILD')await tx.$executeRaw`INSERT INTO integration.period_aggregate_head(query_hash,status,requested_job_id) VALUES(${hash},'REBUILDING',${jobId}::uuid)
    ON CONFLICT(query_hash) DO UPDATE SET status='REBUILDING',requested_job_id=EXCLUDED.requested_job_id,updated_at=now(),failure_code=NULL`;
   await tx.auditEvent.create({data:{actorType:'ADMIN',actorId:p.personId,action:'PERIOD_PROJECTION_REQUESTED',entityType:'PeriodProjectionJob',entityId:jobId,afterData:{queryHash:hash,mode},requestId:randomUUID(),correlationId:randomUUID()}});
   return {jobId,status:'REQUESTED',replayed:false};
  });
 }
 async status(p:TreePrincipal,id:string){
  await authorizeTreePrincipal(this.db,p,PERIOD_ROLES);
  const [job]=await this.db.$queryRaw<any[]>`SELECT job_id,status,mode,query,result,failure_code,requested_at,started_at,completed_at FROM integration.period_projection_job WHERE job_id=${id}::uuid AND actor_id=${p.personId}::uuid`;
  if(!job)throw new NotFoundException({code:'PROJECTION_JOB_NOT_FOUND'});return job;
 }
 async read(p:TreePrincipal,raw:unknown,snapshot?:string,after?:string){
  await authorizeTreePrincipal(this.db,p,PERIOD_ROLES);
  const query=this.parse(p,raw),hash=projectionHash(query);
  if(after&&!snapshot)throw new ConflictException({code:'PROJECTION_SNAPSHOT_REQUIRED'});
  if(after&&!/^[-a-zA-Z0-9_.:]{1,200}$/.test(after))throw new UnprocessableEntityException({code:'INVALID_PROJECTION_CURSOR'});
  const result=await this.db.$transaction(async tx=>{
   const [head]=await tx.$queryRaw<any[]>`SELECT * FROM integration.period_aggregate_head WHERE query_hash=${hash}`;
   const id=snapshot??head?.generation_id;
   if(!id)return {result:null,status:'UNAVAILABLE',projectionStatus:head?.status??'STALE',time:query.time,definitionVersion:'1',dataThrough:null,snapshot:null,nextCursor:null};
   const [generation]=await tx.$queryRaw<any[]>`SELECT * FROM integration.period_aggregate_generation WHERE generation_id=${id}::uuid AND query_hash=${hash}`;
   if(!generation)throw new ConflictException({code:'PROJECTION_SNAPSHOT_CONTEXT_CHANGED'});
   const limit=Math.min(query.limit,100);
   const rows=await tx.$queryRaw<any[]>(Prisma.sql`SELECT row_key AS key,dimensions,measures,evidence FROM integration.period_aggregate_row
    WHERE generation_id=${id}::uuid ${after?Prisma.sql`AND row_key>${after}`:Prisma.empty} ORDER BY row_key LIMIT ${limit+1}`);
   const state=head?.generation_id===id?head.status:generation.status;
   return {result:state==='CURRENT'?rows.slice(0,limit):null,isLatestGeneration:head?.generation_id===id,status:state==='CURRENT'?(generation.manifest.coverage==='PARTIAL'?'PARTIAL':'AVAILABLE'):'UNAVAILABLE',projectionStatus:state,finality:'NOT_APPLICABLE',quality:state==='CURRENT'?(generation.manifest.coverage==='PARTIAL'?'PARTIAL':'VERIFIED'):'UNAVAILABLE',
    time:query.time,scope:query.filters,updatedAt:generation.projected_at.toISOString(),dataThrough:generation.data_through.toISOString(),
    metricKey:query.metrics[0],definitionVersion:generation.definition_version,projectionVersion:generation.projection_version,
    ruleVersion:null,parameterVersion:null,versionReason:'VERSIONS_RETAINED_IN_SOURCE_EVIDENCE',dataClassification:'FINANCE_CONFIDENTIAL',
    evidenceRefs:[{type:'PeriodAggregateGeneration',id,revision:generation.source_hash}],explainCode:state==='CURRENT'?'VERIFIED_SOURCE':'SOURCE_UNAVAILABLE',
    canonicalDeepLink:null,snapshot:id,total:generation.row_count,nextCursor:rows.length>limit?rows[limit-1].key:null,manifest:generation.manifest};
  },{isolationLevel:'RepeatableRead'});
  await authorizeTreePrincipal(this.db,p,PERIOD_ROLES);return result;
 }
 async runOne(){
  const token=randomUUID();
  const [job]=await this.db.$queryRaw<Job[]>`WITH candidate AS (
   SELECT job_id FROM integration.period_projection_job WHERE status='REQUESTED' OR (status='RUNNING' AND lease_until<now())
   ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 1)
   UPDATE integration.period_projection_job j SET status='RUNNING',lease_token=${token}::uuid,lease_until=now()+interval '30 minutes',attempts=attempts+1,started_at=coalesce(started_at,now())
   FROM candidate c WHERE j.job_id=c.job_id RETURNING j.*`;
  if(!job)return null;
  try{
   await this.db.$transaction(async tx=>{
    const claimed=await tx.$queryRaw<any[]>`SELECT job_id FROM integration.period_projection_job WHERE job_id=${job.job_id}::uuid AND lease_token=${token}::uuid FOR UPDATE`;if(claimed.length!==1)throw Error('PROJECTION_LEASE_LOST');
    await authorizeTreePrincipal(this.db,job.actor_context,PERIOD_ROLES,tx);
    const query=this.parse(job.actor_context,job.query);
    const [snapshot]=await tx.$queryRaw<Array<{identity:string}>>`SELECT txid_current_snapshot()::text identity`;
    const projected=await projectPeriodFacts(tx,query);
    if(projected.rows.length>10000)throw Error('PROJECTION_DIMENSION_LIMIT');
    const sourceHash=projectionHash(projected),generation=randomUUID();
    const [prior]=await tx.$queryRaw<any[]>`SELECT g.source_hash,g.generation_id FROM integration.period_aggregate_head h
     JOIN integration.period_aggregate_generation g ON g.generation_id=h.generation_id WHERE h.query_hash=${job.query_hash}`;
    const matches=prior?prior.source_hash===sourceHash:null;
    if(job.mode==='REBUILD'){
     await tx.$executeRaw`INSERT INTO integration.period_aggregate_generation(generation_id,job_id,query_hash,query,metric_group,definition_version,projection_version,data_through,database_snapshot,manifest,source_hash,row_count,status)
      VALUES(${generation}::uuid,${job.job_id}::uuid,${job.query_hash},${JSON.stringify(query)}::jsonb,${projectionGroup(query)},'1',${PROJECTION_VERSION},${new Date(query.time.knowledgeCutoff)},${snapshot.identity},${JSON.stringify(projected.manifest)}::jsonb,${sourceHash},${projected.rows.length},${projected.status})`;
     for(const row of projected.rows)await tx.$executeRaw`INSERT INTO integration.period_aggregate_row(generation_id,row_key,dimensions,measures,evidence)
      VALUES(${generation}::uuid,${row.key},${JSON.stringify(row.dimensions)}::jsonb,${JSON.stringify(row.measures)}::jsonb,${JSON.stringify(row.evidence)}::jsonb)`;
     await tx.$executeRaw`INSERT INTO integration.period_aggregate_head(query_hash,generation_id,status) VALUES(${job.query_hash},${generation}::uuid,${projected.status})
      ON CONFLICT(query_hash) DO UPDATE SET generation_id=EXCLUDED.generation_id,status=EXCLUDED.status,updated_at=now(),failure_code=NULL WHERE integration.period_aggregate_head.requested_job_id=${job.job_id}::uuid`;
    }
    const result={mode:job.mode,generation:job.mode==='REBUILD'?generation:null,sourceHash,previousGeneration:prior?.generation_id??null,reconciles:matches,rowCount:projected.rows.length,status:projected.status,manifest:projected.manifest};
    await tx.$executeRaw`UPDATE integration.period_projection_job SET status='COMPLETED',lease_token=NULL,lease_until=NULL,completed_at=now(),result=${JSON.stringify(result)}::jsonb WHERE job_id=${job.job_id}::uuid AND lease_token=${token}::uuid`;
   },{isolationLevel:'RepeatableRead',timeout:1500000,maxWait:10000});
   return {jobId:job.job_id,status:'COMPLETED'};
  }catch(error){
   const code=error instanceof Error&&/^[A-Z][A-Z0-9_]{2,80}$/.test(error.message)?error.message:'PROJECTION_FAILED';
   await this.db.$transaction(async tx=>{
    const updated=await tx.$executeRaw`UPDATE integration.period_projection_job SET status='FAILED',failure_code=${code},lease_token=NULL,lease_until=NULL,completed_at=now() WHERE job_id=${job.job_id}::uuid AND lease_token=${token}::uuid`;
    if(updated&&job.mode==='REBUILD')await tx.$executeRaw`UPDATE integration.period_aggregate_head SET status='FAILED',failure_code=${code},updated_at=now() WHERE query_hash=${job.query_hash} AND requested_job_id=${job.job_id}::uuid`;
   });
   return {jobId:job.job_id,status:'FAILED',code};
  }
 }
}
