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
const database='ucell_learning_upgrade_'+randomUUID().replaceAll('-','');assert.match(database,/^ucell_learning_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma'),scratch=mkdtempSync(join(tmpdir(),'ucell-learning-upgrade-'));
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});let created=false;
function deploy(schema){const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(result.error)throw result.error;assert.equal(result.status,0);}
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<'20261001020000_learning_evidence_integrity')cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;deploy(join(scratch,'schema.prisma'));
 const person=await db.person.create({data:{legalName:'SYNTHETIC LEARNING UPGRADE'}}),course=await db.learningCourse.create({data:{courseCode:'UPGRADE_COURSE',status:'PUBLISHED',createdByActor:'SYNTHETIC'}});
 const version=await db.learningCourseVersion.create({data:{learningCourseId:course.learningCourseId,version:1,title:'Historical content',categoryCode:'ONBOARDING',contentHash:'a'.repeat(64),status:'PUBLISHED',approvalReference:'APPROVED-LEGACY',approvedAt:new Date('2020-01-01Z'),lessons:{create:{sequenceNo:1,title:'Historical lesson',contentType:'ARTICLE',contentReference:'Historical body'}}},include:{lessons:true}});
 const enrollment=await db.learningEnrollment.create({data:{learningCourseId:course.learningCourseId,learningCourseVersionId:version.learningCourseVersionId,personId:person.personId,status:'COMPLETED',enrolledAt:new Date('2020-01-02Z'),startedAt:new Date('2020-01-03Z'),completedAt:new Date('2020-01-04Z')}});
 const progress=await db.learningProgressEvent.create({data:{learningEnrollmentId:enrollment.learningEnrollmentId,learningLessonId:version.lessons[0].learningLessonId,eventType:'LESSON_COMPLETED',occurredAt:new Date('2020-01-03Z'),idempotencyKey:'UPGRADE-PROGRESS',evidenceHash:'b'.repeat(64)}});
 const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',grossAmount:10,netAmount:10,ruleVersionCode:'TEST_UPGRADE'}});
 deploy(join(root,'schema.prisma'));
 assert.deepEqual(await db.learningCourse.findUnique({where:{learningCourseId:course.learningCourseId}}),course);
 assert.deepEqual(await db.learningCourseVersion.findUnique({where:{learningCourseVersionId:version.learningCourseVersionId},include:{lessons:true}}),version);
 assert.deepEqual(await db.learningEnrollment.findUnique({where:{learningEnrollmentId:enrollment.learningEnrollmentId}}),enrollment);
 assert.deepEqual(await db.learningProgressEvent.findUnique({where:{learningProgressEventId:progress.learningProgressEventId}}),progress);
 assert.deepEqual(await db.order.findUnique({where:{orderId:order.orderId}}),order);
 await assert.rejects(db.learningCourseVersion.update({where:{learningCourseVersionId:version.learningCourseVersionId},data:{title:'Changed'}}));
 await assert.rejects(db.learningLesson.update({where:{learningLessonId:version.lessons[0].learningLessonId},data:{contentReference:'Changed'}}));
 await assert.rejects(db.learningProgressEvent.delete({where:{learningProgressEventId:progress.learningProgressEventId}}));
 await assert.rejects(db.learningEnrollment.update({where:{learningEnrollmentId:enrollment.learningEnrollmentId},data:{completedAt:new Date()}}));
 console.log('LEARNING_UPGRADE_122_TO_123_PRESERVATION_PASS');
}finally{
 await db.$disconnect();if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('LEARNING_UPGRADE_CLEANUP_PASS');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-learning-upgrade-'));rmSync(scratch,{recursive:true,force:true});
}
