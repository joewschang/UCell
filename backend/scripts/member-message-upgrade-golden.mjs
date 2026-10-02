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
const database='ucell_message_upgrade_'+randomUUID().replaceAll('-','');assert.match(database,/^ucell_message_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma'),scratch=mkdtempSync(join(tmpdir(),'ucell-message-upgrade-'));
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});let created=false;
function deploy(schema){const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(result.error)throw result.error;assert.equal(result.status,0);}
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<'20261001010000_member_message_lifecycle')cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;deploy(join(scratch,'schema.prisma'));
 const person=await db.person.create({data:{legalName:'SYNTHETIC MESSAGE UPGRADE'}}),id=randomUUID(),at=new Date('2020-01-02T03:04:05Z'),readAt=new Date('2020-01-03T03:04:05Z');
 await db.$executeRaw`INSERT INTO integration.member_notification(notification_id,person_id,category,title,body,created_at) VALUES(${id}::uuid,${person.personId}::uuid,'SERVICE','Historical title','Historical immutable body',${at})`;
 await db.memberNotificationRead.create({data:{notificationId:id,personId:person.personId,readAt}});
 const old=await db.$queryRaw`SELECT notification_id,person_id,qualification_id,category,title,body,created_at,source_event_id FROM integration.member_notification WHERE notification_id=${id}::uuid`,receipt=await db.memberNotificationRead.findMany();
 const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',grossAmount:10,netAmount:10,ruleVersionCode:'TEST_UPGRADE'}});
 deploy(join(root,'schema.prisma'));
 assert.deepEqual(await db.$queryRaw`SELECT notification_id,person_id,qualification_id,category,title,body,created_at,source_event_id FROM integration.member_notification WHERE notification_id=${id}::uuid`,old);
 assert.deepEqual(await db.memberNotificationRead.findMany(),receipt);assert.deepEqual(await db.order.findUnique({where:{orderId:order.orderId}}),order);
 const upgraded=await db.memberNotification.findUniqueOrThrow({where:{notificationId:id}});assert.equal(upgraded.publishedAt.toISOString(),at.toISOString());assert.equal(upgraded.expiresAt,null);assert.equal(upgraded.messageKey,null);
 await db.memberNotificationArchive.create({data:{notificationId:id,personId:person.personId}});assert.deepEqual(await db.memberNotificationRead.findMany(),receipt);
 await assert.rejects(db.memberNotificationRead.update({where:{notificationId_personId:{notificationId:id,personId:person.personId}},data:{readAt:new Date()}}));
 await assert.rejects(db.memberNotificationArchive.delete({where:{notificationId_personId:{notificationId:id,personId:person.personId}}}));
 await assert.rejects(db.memberNotification.create({data:{personId:person.personId,category:'LEARNING',title:'Bad window',body:'Synthetic',publishedAt:at,expiresAt:at}}));
 console.log('MEMBER_MESSAGE_UPGRADE_121_TO_122_PRESERVATION_PASS');
}finally{
 await db.$disconnect();if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('MEMBER_MESSAGE_UPGRADE_CLEANUP_PASS');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-message-upgrade-'));rmSync(scratch,{recursive:true,force:true});
}
