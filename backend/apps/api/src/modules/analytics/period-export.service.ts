import {Prisma,PrismaService} from '@ucell/database';
import {ConflictException,GoneException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {createHash,randomUUID} from 'node:crypto';
import {authorizeTreePrincipal,TreePrincipal} from '../binary-tree/tree-authorization';
import {PeriodProjectionService,PERIOD_ROLES,projectionHash} from './period-projection.service';
const cell=(value:unknown)=>{let s=typeof value==='string'?value:JSON.stringify(value);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
@Injectable()
export class PeriodExportService{
 constructor(private readonly db:PrismaService,private readonly projections:PeriodProjectionService){}
 async request(p:TreePrincipal,query:unknown,snapshot:string,key:string){
  if(typeof key!=='string'||!/^[-a-zA-Z0-9_:]{1,128}$/.test(key))throw new UnprocessableEntityException({code:'INVALID_EXPORT_REQUEST'});
  const read=await this.projections.read(p,query,snapshot);
  if(read.status!=='AVAILABLE'&&read.status!=='PARTIAL')throw new ConflictException({code:'EXPORT_PROJECTION_NOT_CURRENT'});
  const id=randomUUID(),hash=projectionHash({query,snapshot});
  return this.db.$transaction(async tx=>{
   await authorizeTreePrincipal(this.db,p,PERIOD_ROLES,tx);
   await tx.$queryRaw`SELECT person_id FROM identity.person WHERE person_id=${p.personId}::uuid FOR UPDATE`;
   const [existing]=await tx.$queryRaw<any[]>`SELECT * FROM integration.analytics_export_job WHERE actor_id=${p.personId}::uuid AND request_key=${key}`;
   if(existing){if(existing.query_hash!==hash)throw new ConflictException({code:'IDEMPOTENCY_CONFLICT'});return {exportId:existing.export_id,status:existing.status,replayed:true};}
   const [count]=await tx.$queryRaw<any[]>`SELECT count(*)::integer n FROM integration.analytics_export_job WHERE actor_id=${p.personId}::uuid AND status IN ('REQUESTED','RUNNING')`;
   if(count.n>=10)throw new ConflictException({code:'EXPORT_QUEUE_LIMIT'});
   await tx.$executeRaw`INSERT INTO integration.analytics_export_job(export_id,actor_id,actor_context,request_key,query_hash,query,generation_id,expires_at,data_through,definition_version)
    VALUES(${id}::uuid,${p.personId}::uuid,${JSON.stringify(p)}::jsonb,${key},${hash},${JSON.stringify(query)}::jsonb,${snapshot}::uuid,now()+interval '24 hours',${new Date(read.dataThrough!)},${read.definitionVersion})`;
   await tx.auditEvent.create({data:{actorType:'ADMIN',actorId:p.personId,action:'PERIOD_EXPORT_REQUESTED',entityType:'ExportJob',entityId:id,afterData:{snapshot,queryHash:hash},requestId:randomUUID(),correlationId:randomUUID()}});
   return {exportId:id,status:'REQUESTED',replayed:false};
  });
 }
 async status(p:TreePrincipal,id:string){
  await authorizeTreePrincipal(this.db,p,PERIOD_ROLES);
  await this.db.$executeRaw`UPDATE integration.analytics_export_job SET status='EXPIRED',lease_token=NULL,lease_until=NULL WHERE export_id=${id}::uuid AND actor_id=${p.personId}::uuid AND expires_at<=now() AND status<>'EXPIRED'`;
  const [job]=await this.db.$queryRaw<any[]>`SELECT export_id,status,generation_id AS snapshot,query,requested_at,generated_at,expires_at,data_through,definition_version,row_count,chunk_count,content_hash,failure_code
   FROM integration.analytics_export_job WHERE export_id=${id}::uuid AND actor_id=${p.personId}::uuid`;
  if(!job)throw new NotFoundException({code:'EXPORT_NOT_FOUND'});return job;
 }
 async runOne(){
  const token=randomUUID();
  const [job]=await this.db.$queryRaw<any[]>`WITH candidate AS (
   SELECT export_id FROM integration.analytics_export_job WHERE expires_at>now() AND (status='REQUESTED' OR (status='RUNNING' AND lease_until<now()))
   ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 1)
   UPDATE integration.analytics_export_job j SET status='RUNNING',lease_token=${token}::uuid,lease_until=now()+interval '30 minutes'
   FROM candidate c WHERE j.export_id=c.export_id RETURNING j.*`;
  if(!job)return null;
  try{
   await this.db.$transaction(async tx=>{
    const [owned]=await tx.$queryRaw<any[]>`SELECT export_id FROM integration.analytics_export_job WHERE export_id=${job.export_id}::uuid AND lease_token=${token}::uuid AND expires_at>now() FOR UPDATE`;
    if(!owned)throw Error('EXPORT_LEASE_LOST');
    await authorizeTreePrincipal(this.db,job.actor_context,PERIOD_ROLES,tx);
    const [generation]=await tx.$queryRaw<any[]>`SELECT * FROM integration.period_aggregate_generation WHERE generation_id=${job.generation_id}::uuid`;
    if(generation.status!=='CURRENT')throw Error('EXPORT_PROJECTION_NOT_CURRENT');
    const generatedAt=new Date().toISOString(),digest=createHash('sha256');
    let chunk=0,total=0,cursor:string|undefined;
    let csv='reportType,periodStart,periodEnd,filters,asOf,snapshot,generatedAt,dataThrough,definitionVersion,rowKey,dimensions,measures,evidence\r\n';
    const flush=async()=>{digest.update(csv);await tx.$executeRaw`INSERT INTO integration.analytics_export_chunk(export_id,chunk_no,csv) VALUES(${job.export_id}::uuid,${chunk},${csv})`;chunk++;csv='';};
    for(;;){
     const rows=await tx.$queryRaw<any[]>(Prisma.sql`SELECT * FROM integration.period_aggregate_row WHERE generation_id=${job.generation_id}::uuid
      ${cursor?Prisma.sql`AND row_key>${cursor}`:Prisma.empty} ORDER BY row_key LIMIT 500`);
     if(!rows.length)break;
     for(const row of rows){
      const line=[generation.query.metrics[0],generation.query.time.periodStart,generation.query.time.periodEnd,generation.query.filters,generation.query.time.asOf,job.generation_id,generatedAt,generation.data_through.toISOString(),generation.definition_version,row.row_key,row.dimensions,row.measures,row.evidence].map(cell).join(',')+'\r\n';
      if(Buffer.byteLength(line)>1048576)throw Error('EXPORT_ROW_TOO_LARGE');
      if(Buffer.byteLength(csv)+Buffer.byteLength(line)>1048576)await flush();
      csv+=line;total++;
     }
     cursor=rows[rows.length-1].row_key;
    }
    if(csv)await flush();
    if(total!==generation.row_count)throw Error('EXPORT_ROW_RECONCILIATION_FAILED');
    await tx.$executeRaw`UPDATE integration.analytics_export_job SET status='COMPLETED',lease_token=NULL,lease_until=NULL,generated_at=${new Date(generatedAt)},chunk_count=${chunk},row_count=${total},content_hash=${digest.digest('hex')} WHERE export_id=${job.export_id}::uuid AND lease_token=${token}::uuid`;
   },{isolationLevel:'RepeatableRead',timeout:1500000,maxWait:10000});
   return {exportId:job.export_id,status:'COMPLETED'};
  }catch{
   await this.db.$executeRaw`UPDATE integration.analytics_export_job SET status='FAILED',lease_token=NULL,lease_until=NULL,failure_code='EXPORT_FAILED' WHERE export_id=${job.export_id}::uuid AND lease_token=${token}::uuid`;
   return {exportId:job.export_id,status:'FAILED'};
  }
 }
 async *download(p:TreePrincipal,id:string){
  const job=await this.status(p,id);if(job.status==='EXPIRED')throw new GoneException({code:'EXPORT_EXPIRED'});
  if(job.status!=='COMPLETED')throw new ConflictException({code:'EXPORT_NOT_COMPLETED'});
  await this.db.auditEvent.create({data:{actorType:'ADMIN',actorId:p.personId,action:'PERIOD_EXPORT_DOWNLOADED',entityType:'ExportJob',entityId:id,requestId:randomUUID(),correlationId:randomUUID()}});
  for(let i=0;i<job.chunk_count;i++){
   await authorizeTreePrincipal(this.db,p,PERIOD_ROLES);
   if(new Date(job.expires_at)<=new Date())throw new GoneException({code:'EXPORT_EXPIRED'});
   const [row]=await this.db.$queryRaw<any[]>`SELECT csv FROM integration.analytics_export_chunk WHERE export_id=${id}::uuid AND chunk_no=${i}`;
   if(!row)throw Error('EXPORT_CHUNK_MISSING');yield Buffer.from(row.csv,'utf8');
  }
 }
}
