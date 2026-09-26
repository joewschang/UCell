import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const root=fileURLToPath(new URL('../',import.meta.url));
const schema=join(root,'packages','database','prisma','schema.prisma');
const recoverySql=join(root,'packages','database','prisma','recovery','migration-87-append-safe-reconciliation.sql');
const migration='20260926110000_g8_audit_event_core';
const url=new URL(process.env.DATABASE_URL??'');
assert.equal(process.env.UCELL_ENVIRONMENT,'STAGE','G8 recovery requires UCELL_ENVIRONMENT=STAGE');
assert.equal(process.env.NODE_ENV,'staging','G8 recovery requires NODE_ENV=staging');
assert.equal(url.pathname,'/ucell_stage','G8 recovery requires the Stage database name');
assert.match(url.hostname,/\.postgres\.database\.azure\.com$/,'G8 recovery requires an Azure PostgreSQL Stage host');
const db=new PrismaClient();
const expectedColumns=['event_code','environment','trace_id','actor_role_snapshot','result','changed_field_names','before_hash','after_hash','evidence_ref','severity','privacy_class','retention_class','created_at'];
const expectedTriggers=['trg_audit_event_append_only','trg_audit_event_before_insert','trg_audit_event_no_update','trg_audit_event_no_delete'];
const expectedIndexes=['ix_audit_event_trace_occurred','ix_audit_event_environment_code_occurred'];
function runPrisma(args){const r=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),...args],{cwd:root,env:process.env,encoding:'utf8'});if(r.status!==0)throw new Error(`PRISMA_COMMAND_FAILED ${args.join(' ')}: ${(r.stderr||r.stdout).slice(-1000)}`);}
async function auditFingerprint(){
 const rows=await db.$queryRawUnsafe("SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(concat_ws('|',audit_event_id::text,actor_type,coalesce(actor_id::text,''),action,entity_type,coalesce(entity_id::text,''),coalesce(before_data::text,''),coalesce(after_data::text,''),coalesce(reason_code,''),request_id,correlation_id::text,occurred_at::text)),'') ORDER BY audit_event_id),'') AS fingerprint FROM audit.audit_event");
 return rows[0];
}
async function ledger(){return db.$queryRawUnsafe(`SELECT migration_name,finished_at IS NULL AS unfinished,rolled_back_at IS NULL AS not_rolled_back,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back,checksum FROM public._prisma_migrations WHERE migration_name='${migration}' ORDER BY started_at DESC`);}
async function postcondition(){
 const columns=await db.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='audit' AND table_name='audit_event' AND column_name=ANY(ARRAY['event_code','environment','trace_id','actor_role_snapshot','result','changed_field_names','before_hash','after_hash','evidence_ref','severity','privacy_class','retention_class','created_at']) ORDER BY column_name");
 const triggers=await db.$queryRawUnsafe("SELECT tgname FROM pg_trigger WHERE tgrelid='audit.audit_event'::regclass AND NOT tgisinternal ORDER BY tgname");
 const indexes=await db.$queryRawUnsafe("SELECT indexname FROM pg_indexes WHERE schemaname='audit' AND tablename='audit_event' AND indexname=ANY(ARRAY['ix_audit_event_trace_occurred','ix_audit_event_environment_code_occurred']) ORDER BY indexname");
 assert.deepEqual(columns.map(x=>x.column_name).sort(),[...expectedColumns].sort(),'migration 87 columns');
 assert.deepEqual(triggers.filter(x=>expectedTriggers.includes(x.tgname)).map(x=>x.tgname).sort(),[...expectedTriggers].sort(),'audit triggers');
 assert.deepEqual(indexes.map(x=>x.indexname).sort(),[...expectedIndexes].sort(),'audit indexes');
 return {columns:columns.length,triggers:expectedTriggers,indexes:expectedIndexes};
}
async function verifyRuntime(before){
 const requestId=`G8_M87_RECOVERY_${randomUUID()}`;
 const created=await db.auditEvent.create({data:{actorType:'SYSTEM',action:'G8_MIGRATION_87_RECOVERY_VERIFIED',entityType:'OperationalRecovery',requestId,correlationId:randomUUID()}});
 let updateBlocked=false,deleteBlocked=false;
 try{await db.$executeRawUnsafe(`UPDATE audit.audit_event SET action='MUTATED' WHERE request_id='${requestId}'`);}catch(error){updateBlocked=String(error).includes('append-only');}
 try{await db.$executeRawUnsafe(`DELETE FROM audit.audit_event WHERE request_id='${requestId}'`);}catch(error){deleteBlocked=String(error).includes('append-only');}
 const after=await auditFingerprint();
 assert.equal(created.eventCode,'G8_MIGRATION_87_RECOVERY_VERIFIED');assert.equal(created.traceId,created.correlationId);assert.equal(updateBlocked,true);assert.equal(deleteBlocked,true);assert.equal(after.count,before.count+1);
 return {newEventCode:created.eventCode,traceIdPopulated:true,updateBlocked,deleteBlocked,preExistingFingerprintUnchanged:true};
}
const mode=process.argv[2]??'precheck';
try{
 const before=await auditFingerprint(),beforeLedger=await ledger();
 if(mode==='precheck'){
  const failed=beforeLedger.some(x=>x.unfinished&&x.not_rolled_back);
  assert.equal(failed,true,'migration 87 must be the recorded failed Stage migration before recovery');
  console.log(JSON.stringify({result:'PASS',mode,stageDatabase:url.pathname.slice(1),audit:{count:before.count,fingerprint:before.fingerprint},ledger:beforeLedger},null,2));
 }else if(mode==='recover'){
  const failed=beforeLedger.some(x=>x.unfinished&&x.not_rolled_back);assert.equal(failed,true,'migration 87 must be failed before reconciliation');
  runPrisma(['migrate','resolve','--rolled-back',migration,'--schema',schema]);
  runPrisma(['db','execute','--file',recoverySql,'--schema',schema]);
  const schemaResult=await postcondition();
  const runtime=await verifyRuntime(before);
  runPrisma(['migrate','resolve','--applied',migration,'--schema',schema]);
  runPrisma(['migrate','deploy','--schema',schema]);
  const finalLedger=await ledger();assert.equal(finalLedger.some(x=>x.finished&&x.not_rolled_back),true,'migration 87 applied ledger');
  console.log(JSON.stringify({result:'PASS',mode,stageDatabase:url.pathname.slice(1),preRecoveryAudit:{count:before.count,fingerprint:before.fingerprint},postcondition:schemaResult,runtime,ledger:finalLedger},null,2));
 }else throw new Error('Usage: g8-stage-migration87-recovery.mjs [precheck|recover]');
}finally{await db.$disconnect();}
