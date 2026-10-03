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
const database='ucell_assignment_upgrade_'+randomUUID().replaceAll('-','');assert.match(database,/^ucell_assignment_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma'),scratch=mkdtempSync(join(tmpdir(),'ucell-assignment-upgrade-'));
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});let created=false;
function deploy(schema){const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(result.error)throw result.error;assert.equal(result.status,0);}
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<'20261001050000_learning_assignment_evidence')cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;deploy(join(scratch,'schema.prisma'));
 const person=await db.person.create({data:{legalName:'Preserved learning owner',membershipState:'NETWORK_MEMBER'}}),course=await db.learningCourse.create({data:{courseCode:'UPGRADE-ASSIGNMENT',createdByActor:'TEST'}}),version=await db.learningCourseVersion.create({data:{learningCourseId:course.learningCourseId,version:1,title:'Preserved',categoryCode:'ONBOARDING',contentHash:'a'.repeat(64)}}),enrollment=await db.learningEnrollment.create({data:{learningCourseId:course.learningCourseId,learningCourseVersionId:version.learningCourseVersionId,personId:person.personId}}),event=await db.learningProgressEvent.create({data:{learningEnrollmentId:enrollment.learningEnrollmentId,eventType:'COURSE_ENROLLED',idempotencyKey:'upgrade-enrolled',evidenceHash:'b'.repeat(64)}});
 deploy(join(root,'schema.prisma'));
 assert.deepEqual(await db.person.findUnique({where:{personId:person.personId}}),person);assert.deepEqual(await db.learningCourseVersion.findUnique({where:{learningCourseVersionId:version.learningCourseVersionId}}),version);assert.deepEqual(await db.learningEnrollment.findUnique({where:{learningEnrollmentId:enrollment.learningEnrollmentId}}),enrollment);assert.deepEqual(await db.learningProgressEvent.findUnique({where:{learningProgressEventId:event.learningProgressEventId}}),event);
 await db.learningProgressEvent.create({data:{learningEnrollmentId:enrollment.learningEnrollmentId,eventType:'COURSE_ASSIGNED',idempotencyKey:'upgrade-assigned',evidenceHash:'c'.repeat(64)}});
 await assert.rejects(db.learningProgressEvent.create({data:{learningEnrollmentId:enrollment.learningEnrollmentId,eventType:'COURSE_ASSIGNED',idempotencyKey:'duplicate-assigned',evidenceHash:'c'.repeat(64)}}));
 await assert.rejects(db.learningProgressEvent.create({data:{learningEnrollmentId:enrollment.learningEnrollmentId,eventType:'INVENTED_EVENT',idempotencyKey:'invalid-event',evidenceHash:'c'.repeat(64)}}));
 await assert.rejects(db.learningProgressEvent.update({where:{learningProgressEventId:event.learningProgressEventId},data:{evidenceHash:'d'.repeat(64)}}));
 console.log('LEARNING_ASSIGNMENT_125_TO_126_PRESERVATION_PASS');
}finally{
 await db.$disconnect();if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('LEARNING_ASSIGNMENT_UPGRADE_CLEANUP_PASS');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-assignment-upgrade-'));rmSync(scratch,{recursive:true,force:true});
}
