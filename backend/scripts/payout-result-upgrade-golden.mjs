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
const database='ucell_payout_upgrade_'+randomUUID().replaceAll('-','');
assert.match(database,/^ucell_payout_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma'),scratch=mkdtempSync(join(tmpdir(),'ucell-payout-upgrade-'));
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});
function deploy(schema){const r=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(r.error)throw r.error;assert.equal(r.status,0);}
let created=false;
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<'20260929120000_payout_result_integrity')cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;deploy(join(scratch,'schema.prisma'));
 const person=await db.person.create({data:{legalName:'Synthetic payout upgrade'}}),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
 const batch=await db.payoutBatch.create({data:{periodStart:new Date('2026-01-01Z'),periodEnd:new Date('2026-02-01Z'),status:'EXPORTED',totalGross:100,totalRecovery:0,totalNet:100}});
 const line=await db.payoutLine.create({data:{payoutBatchId:batch.payoutBatchId,recipientQualificationId:q.qualificationId,grossAmount:100,netAmount:100,detailJson:{source:'historical-synthetic'}}});
 const approval=await db.payoutApproval.create({data:{payoutBatchId:batch.payoutBatchId,stage:'FINANCE_REVIEW',decision:'APPROVED',actorId:randomUUID()}});
 const artifact=await db.payoutExportArtifact.create({data:{payoutBatchId:batch.payoutBatchId,exportReference:randomUUID(),adapterCode:'GENERIC_FINANCE_CSV',formatVersion:'GENERIC_FINANCE_CSV_V1',revision:1,contentHash:'a'.repeat(64),payloadSnapshot:{historical:true},generatedByActor:randomUUID()}});
 const result=await db.payoutPaymentResult.create({data:{payoutBatchId:batch.payoutBatchId,payoutLineId:line.payoutLineId,resultStatus:'PAID',paidAmount:40,occurredAt:new Date('2026-02-02Z'),recordedByActor:randomUUID(),idempotencyKey:randomUUID()}});
 deploy(join(root,'schema.prisma'));
 assert.deepEqual(await db.payoutBatch.findUnique({where:{payoutBatchId:batch.payoutBatchId}}),batch);
 assert.deepEqual(await db.payoutLine.findUnique({where:{payoutLineId:line.payoutLineId}}),line);
 assert.deepEqual(await db.payoutApproval.findUnique({where:{payoutApprovalId:approval.payoutApprovalId}}),approval);
 assert.deepEqual(await db.payoutExportArtifact.findUnique({where:{payoutExportArtifactId:artifact.payoutExportArtifactId}}),artifact);
 assert.deepEqual(await db.payoutPaymentResult.findUnique({where:{payoutPaymentResultId:result.payoutPaymentResultId}}),result);
 await assert.rejects(db.payoutPaymentResult.update({where:{payoutPaymentResultId:result.payoutPaymentResultId},data:{paidAmount:30}}));
 await assert.rejects(db.payoutApproval.update({where:{payoutApprovalId:approval.payoutApprovalId},data:{actorId:randomUUID()}}));
 await assert.rejects(db.payoutLine.update({where:{payoutLineId:line.payoutLineId},data:{netAmount:90}}),/PAYOUT_APPROVED_LINES_IMMUTABLE/);
 await assert.rejects(db.payoutBatch.update({where:{payoutBatchId:batch.payoutBatchId},data:{totalNet:90}}),/PAYOUT_APPROVED_TOTALS_IMMUTABLE/);
 const retry={payoutBatchId:batch.payoutBatchId,payoutLineId:line.payoutLineId,resultStatus:'PAID',paidAmount:100,occurredAt:new Date(),recordedByActor:randomUUID(),idempotencyKey:randomUUID()};
 await assert.rejects(db.payoutPaymentResult.create({data:{...retry,paidAmount:30}}),/PAYOUT_PAID_AMOUNT_CANNOT_DECREASE/);
 await db.payoutPaymentResult.create({data:retry});
 console.log('PAYOUT_RESULT_UPGRADE_109_TO_110_PRESERVATION_AND_GUARDS_PASS');
}finally{
 await db.$disconnect();if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('PAYOUT_RESULT_UPGRADE_CLEANUP_PASS');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-payout-upgrade-'));rmSync(scratch,{recursive:true,force:true});
}
