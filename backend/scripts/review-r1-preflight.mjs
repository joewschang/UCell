import fs from 'node:fs';
const failures=[];
const qmod=fs.readFileSync('apps/api/src/modules/qualification/qualification.module.ts','utf8');
const qwf=fs.readFileSync('apps/api/src/modules/qualification/qualification-workflow.service.ts','utf8');
const bq=fs.readFileSync('apps/api/src/modules/bonus/bonus-query.service.ts','utf8');
const bin=fs.readFileSync('apps/api/src/modules/bonus/binary-bonus.service.ts','utf8');
const migration=fs.readFileSync('packages/database/prisma/migrations/0013_review_r1_integrity_guards/migration.sql','utf8');

if(!qmod.includes('QualificationWorkflowService')) failures.push('QualificationWorkflowService not wired');
if(!qwf.includes('reviewFeePaid')) failures.push('Workflow approval does not verify NT$600 review fee');
if(!qwf.includes('qualificationPlanHistory')) failures.push('Upgrade plan history missing');
if(!bq.includes('qualificationPlanAt')) failures.push('Temporal plan lookup missing');
if(!bin.includes('isQualificationEffectiveAt')) failures.push('Binary settlement is not temporal-status aware');
if(!migration.includes('trg_binary_first_third_left')) failures.push('DB first/third-left guard missing');
if(!migration.includes('trg_sponsor_update_guard')) failures.push('DB sponsor update guard missing');

if(failures.length){
  console.error('REVIEW_R1_PREFLIGHT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('REVIEW_R1_PREFLIGHT_PASS');
