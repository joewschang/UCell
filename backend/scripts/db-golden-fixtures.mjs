import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const url=new URL(process.env.DATABASE_URL??'');
const isolated=process.env.GOLDEN_ISOLATION_DATABASE;
if(isolated){assert.match(isolated,/^ucell_dev_golden_[a-f0-9]{32}$/);assert.equal(url.pathname,'/'+isolated);}
else assert.equal(url.pathname,'/ucell_phase2_golden');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const {R10B}=await import('../packages/shared/src/r1-0b-golden.ts');
const dataset=JSON.parse(fs.readFileSync(new URL('../packages/database/prisma/seed/golden-r1-0b.json',import.meta.url)));
const prisma=new PrismaClient(),at=new Date('2020-01-01');
const person=(name)=>'10000000-0000-4000-8000-'+String(dataset.persons.indexOf(name)+1).padStart(12,'0');
const qualification=(name)=>'20000000-0000-4000-8000-'+String(dataset.persons.indexOf(name)+1).padStart(12,'0');
try{await prisma.$transaction(async tx=>{
 for(const name of dataset.persons){await tx.person.upsert({where:{personId:person(name)},update:{},create:{personId:person(name),legalName:'GOLDEN TEST '+name,status:'EFFECTIVE'}});await tx.qualification.upsert({where:{qualificationId:qualification(name)},update:{},create:{qualificationId:qualification(name),currentHolderPersonId:person(name),planLevelCode:dataset.plans[name],status:'EFFECTIVE',effectiveAt:at}});}
 for(const [name,rate] of Object.entries(R10B.pools))await tx.runtimeRuleParameter.upsert({where:{ruleVersionCode_parameterCode_scopeKey_effectiveFrom:{ruleVersionCode:'R1.0B',parameterCode:'pool.'+name+'.rate',scopeKey:'*',effectiveFrom:at}},update:{},create:{ruleVersionCode:'R1.0B',parameterCode:'pool.'+name+'.rate',scopeKey:'*',effectiveFrom:at,effectiveTo:new Date('2026-09-01T00:00:00+08:00'),valueJson:rate}});
 await tx.runtimeRuleParameter.upsert({where:{ruleVersionCode_parameterCode_scopeKey_effectiveFrom:{ruleVersionCode:'R1.0B',parameterCode:'equalization.rate',scopeKey:'LEADER:G5',effectiveFrom:at}},update:{},create:{ruleVersionCode:'R1.0B',parameterCode:'equalization.rate',scopeKey:'LEADER:G5',effectiveFrom:at,effectiveTo:new Date('2026-09-01T00:00:00+08:00'),valueJson:R10B.equalization.LEADER[5]}});
 const sequences=new Map();
 for(const [parent,child] of dataset.sponsorTree){const sequence=(sequences.get(parent)??0)+1;sequences.set(parent,sequence);await tx.sponsorRelationship.upsert({where:{childQualificationId:qualification(child)},update:{},create:{sponsorQualificationId:qualification(parent),childQualificationId:qualification(child),sponsorSequenceNo:sequence,effectiveFrom:at}});}
 for(const [parent,child,side] of dataset.binaryTree){await tx.binaryPlacement.upsert({where:{childQualificationId:qualification(child)},update:{},create:{parentQualificationId:qualification(parent),childQualificationId:qualification(child),side,effectiveFrom:at}});}
});console.log('DB_GOLDEN_FIXTURES_PASS: frozen manifest loaded into isolated test database; no monetary postings');}finally{await prisma.$disconnect();}
