import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url)),{PrismaClient}=require('@prisma/client');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const database='ucell_event_upgrade_'+randomUUID().replaceAll('-','');assert.match(database,/^ucell_event_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma'),scratch=mkdtempSync(join(tmpdir(),'ucell-event-upgrade-'));
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});let created=false;
function deploy(schema){const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(result.error)throw result.error;assert.equal(result.status,0);}
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<'20261001030000_event_participation_evidence')cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;deploy(join(scratch,'schema.prisma'));
 const person=await db.person.create({data:{legalName:'SYNTHETIC EVENT UPGRADE'}}),event=await db.memberEvent.create({data:{eventCode:'UPGRADE_EVENT',status:'PUBLISHED',createdByActor:'SYNTHETIC'}});
 const version=await db.memberEventVersion.create({data:{memberEventId:event.memberEventId,version:1,title:'Historical activity',eventType:'OFFLINE',startsAt:new Date('2020-01-03Z'),endsAt:new Date('2020-01-04Z'),locationReference:'Historical venue',contentHash:'a'.repeat(64),status:'PUBLISHED',approvalReference:'APPROVED-LEGACY',approvedAt:new Date('2020-01-01Z')}}),id=randomUUID(),tokenHash='d'.repeat(64);
 await db.$executeRaw`INSERT INTO learning.member_event_registration(member_event_registration_id,member_event_id,member_event_version_id,person_id,status,check_in_token_hash,registered_at,checked_in_at,attended_at) VALUES(${id}::uuid,${event.memberEventId}::uuid,${version.memberEventVersionId}::uuid,${person.personId}::uuid,'ATTENDED',${tokenHash},'2020-01-02Z','2020-01-03T01:00:00Z','2020-01-03T02:00:00Z')`;
 const original=await db.$queryRaw`SELECT member_event_registration_id,member_event_id,member_event_version_id,person_id,status,check_in_token_hash,registered_at,cancelled_at,checked_in_at,attended_at FROM learning.member_event_registration WHERE member_event_registration_id=${id}::uuid`;
 const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',grossAmount:10,netAmount:10,ruleVersionCode:'TEST_UPGRADE'}});
 deploy(join(root,'schema.prisma'));
 assert.deepEqual(await db.memberEvent.findUnique({where:{memberEventId:event.memberEventId}}),event);
 assert.deepEqual(await db.memberEventVersion.findUnique({where:{memberEventVersionId:version.memberEventVersionId}}),version);
 assert.deepEqual(await db.$queryRaw`SELECT member_event_registration_id,member_event_id,member_event_version_id,person_id,status,check_in_token_hash,registered_at,cancelled_at,checked_in_at,attended_at FROM learning.member_event_registration WHERE member_event_registration_id=${id}::uuid`,original);
 assert.deepEqual(await db.order.findUnique({where:{orderId:order.orderId}}),order);
 const evidence=await db.memberEventParticipationEvidence.findMany({where:{memberEventRegistrationId:id},orderBy:{occurredAt:'asc'}});
 assert.deepEqual(evidence.map(e=>[e.eventType,e.occurredAt.toISOString(),e.origin]),[['EVENT_REGISTERED','2020-01-02T00:00:00.000Z','LEGACY_SNAPSHOT'],['EVENT_CHECKED_IN','2020-01-03T01:00:00.000Z','LEGACY_SNAPSHOT'],['EVENT_ATTENDED','2020-01-03T02:00:00.000Z','LEGACY_SNAPSHOT']]);
 await assert.rejects(db.memberEventVersion.update({where:{memberEventVersionId:version.memberEventVersionId},data:{title:'Changed'}}));
 await assert.rejects(db.memberEventParticipationEvidence.delete({where:{participationEvidenceId:evidence[0].participationEvidenceId}}));
 await assert.rejects(db.memberEventRegistration.update({where:{memberEventRegistrationId:id},data:{attendedAt:new Date()}}));
 console.log('EVENT_UPGRADE_123_TO_124_PRESERVATION_PASS');
}finally{
 await db.$disconnect();if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('EVENT_UPGRADE_CLEANUP_PASS');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-event-upgrade-'));rmSync(scratch,{recursive:true,force:true});
}
