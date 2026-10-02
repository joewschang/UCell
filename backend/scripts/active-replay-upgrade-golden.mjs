import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const database='ucell_active_upgrade_'+randomUUID().replaceAll('-','');
assert.match(database,/^ucell_active_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';
const target=new URL(base);target.pathname='/'+database;
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma');
const scratch=mkdtempSync(join(tmpdir(),'ucell-active-upgrade-'));
function deploy(schema){const r=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(r.error)throw r.error;assert.equal(r.status,0);}
let created=false;
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<'20260929090000_active_replay_interval_removal')cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;deploy(join(scratch,'schema.prisma'));
 const p=await db.person.create({data:{legalName:'Synthetic Active upgrade'}}),q=await db.qualification.create({data:{currentHolderPersonId:p.personId,planLevelCode:'STARTER'}});
 const month=new Date('2026-09-01'),from=new Date('2026-09-10'),to=new Date('2026-09-30T16:00:00Z');
 const recognition=await db.consumptionRecognitionEvent.create({data:{qualificationId:q.qualificationId,sourceType:'TEST',sourceId:randomUUID(),eligible:true,eligibleAmount:1400,recognitionPurpose:'GPV',productProfileVersion:'TEST',ruleVersionCode:'R1',parameterSnapshotHash:'a'.repeat(64),recognizedAt:from,recognitionMonth:month,idempotencyKey:randomUUID(),correlationId:randomUUID(),evidenceHash:'a'.repeat(64)}});
 const accumulator=await db.qualificationMonthAccumulatorEvidence.create({data:{qualificationId:q.qualificationId,calendarMonth:month,consumptionRecognitionEventId:recognition.consumptionRecognitionEventId,cumulativeBefore:0,eligibleDelta:1400,cumulativeAfter:1400,activeThreshold:1200,thresholdCrossed:true,epvAfter:1400,sequenceNo:1,ruleVersionCode:'R1',evidenceHash:'a'.repeat(64),idempotencyKey:randomUUID()}});
 const data={qualificationId:q.qualificationId,calendarMonth:month,sourceAccumulatorEvidenceId:accumulator.qualificationMonthAccumulatorEvidenceId,activeFrom:from,activeTo:to,reasonCode:'MONTHLY_ELIGIBLE_CONSUMPTION_THRESHOLD',ruleVersionCode:'R1',evidenceHash:'a'.repeat(64)};
 const original=await db.activeIntervalEvidence.create({data:{...data,idempotencyKey:randomUUID()}});
 const removal={...data,activeFrom:to,activeTo:to,reasonCode:'HISTORICAL_RETURN_REPLAY_INACTIVE',supersedesActiveEvidenceId:original.activeIntervalEvidenceId};
 await assert.rejects(db.activeIntervalEvidence.create({data:{...removal,idempotencyKey:randomUUID()}}),/ck_active_interval_order/);
 deploy(join(root,'schema.prisma'));
 assert.deepEqual(await db.activeIntervalEvidence.findUnique({where:{activeIntervalEvidenceId:original.activeIntervalEvidenceId}}),original);
 assert.deepEqual(await db.qualificationMonthAccumulatorEvidence.findUnique({where:{qualificationMonthAccumulatorEvidenceId:accumulator.qualificationMonthAccumulatorEvidenceId}}),accumulator);
 await db.activeIntervalEvidence.create({data:{...removal,idempotencyKey:randomUUID()}});
 for(const invalid of [{...removal,reasonCode:'OTHER'},{...removal,supersedesActiveEvidenceId:null},{...removal,activeFrom:from},{...data,activeFrom:to,activeTo:from}])await assert.rejects(db.activeIntervalEvidence.create({data:{...invalid,idempotencyKey:randomUUID()}}),/ck_active_interval_order/);
 await assert.rejects(db.activeIntervalEvidence.update({where:{activeIntervalEvidenceId:original.activeIntervalEvidenceId},data:{activeTo:new Date('2026-10-02')}}));
 console.log('ACTIVE_REPLAY_UPGRADE_106_TO_107_PRESERVATION_AND_GUARDS_PASS');
}finally{
 await db.$disconnect();if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('ACTIVE_REPLAY_UPGRADE_CLEANUP_PASS');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-active-upgrade-'));rmSync(scratch,{recursive:true,force:true});
}
