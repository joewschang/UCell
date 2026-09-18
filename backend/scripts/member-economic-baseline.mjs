import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from 'typescript';
const baseline=process.argv[2];assert.match(baseline??'',/^[a-f0-9]{40}$/);
const git=path=>execFileSync('git',['show',baseline+':backend/'+path],{encoding:'utf8'}).replaceAll('\r\n','\n');
const current=path=>fs.readFileSync(path,'utf8').replaceAll('\r\n','\n');
const hash=s=>createHash('sha256').update(s).digest('hex');
const failures=[],sources=[];
for(const path of ['packages/shared/src/r1-0b-golden.ts','packages/database/src/recognition-active.ts','packages/database/src/gpv-immediate-effects.ts','packages/database/src/bonus-maturity.ts','packages/database/src/parameter-snapshot.ts','packages/database/src/replay-pool-delta.ts','apps/api/src/modules/payout/recovery-balance.service.ts']){
 const before=hash(git(path)),after=hash(current(path));sources.push({path,before,after,unchanged:before===after});if(before!==after)failures.push('changed source '+path);
}
function expectations(text){
 const file=ts.createSourceFile('test.ts',text,ts.ScriptTarget.Latest,true),found=[];
 const visit=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&/^to[A-Z]/.test(node.expression.name.text)&&node.expression.expression.getText(file).startsWith('expect('))found.push(node.getText(file).replace(/\s+/g,''));ts.forEachChild(node,visit);};visit(file);return found;
}
const fixtures=[];
for(const name of ['a-decision-return','bonus-engine-v04','connected-dev-defects','epv-global-v05','negative-flow-v05','v061-replay','v063-golden-path','v3-mandatory-contract']){
 const path='apps/api/test/'+name+'.e2e-spec.ts',before=expectations(git(path)),after=expectations(current(path)),missing=before.filter(x=>!after.includes(x));
 fixtures.push({path,baselineExpectations:before.length,currentExpectations:after.length,missing});if(missing.length)failures.push('changed baseline assertions '+path);
}
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
function moduleOf(source){const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,m={exports:{}};new Function('require','module','exports',code)(require,m,m.exports);return m.exports;}
const oldGlobal=moduleOf(git('apps/api/src/modules/global-pool/global-pool-calculation.ts')),newGlobal=moduleOf(current('packages/database/src/global-pool-calculation.ts')),{Prisma}=require('@prisma/client');
let comparedGlobalVectors=0;
for(const total of ['0','0.0001','1','12345.6789','802000','1000000000'])for(const population of [0,1,2,3,7,100]){
 const value=new Prisma.Decimal(total),pool=value.mul('.05'),inputs=[{level:'NEW_STAR',rate:new Prisma.Decimal('.015'),eligibleQualificationIds:Array.from({length:population},(_,i)=>'member-'+i)},{level:'EXCELLENCE',rate:new Prisma.Decimal('.01'),eligibleQualificationIds:[]}];
 assert.equal(JSON.stringify(newGlobal.calculateGlobalPool(value,pool,inputs)),JSON.stringify(oldGlobal.calculateGlobalPool(value,pool,inputs)));comparedGlobalVectors++;
}
const report={baseline,status:failures.length?'FAIL':'PASS',unchangedCoreSources:sources,unchangedMemberFixtureAssertions:fixtures,comparedGlobalVectors,failures,scope:'Baseline arithmetic/recognition/Active/maturity/recovery source and preserved ordinary-member expectations; execute current full API/DB Golden and Member Global payout integration separately. This is not a production data comparison.'};
fs.writeFileSync('../governance/next-generation/evidence/member-economic-baseline.json',JSON.stringify(report,null,2));console.log('MEMBER_ECONOMIC_BASELINE_'+report.status,JSON.stringify({fixtures:fixtures.length,assertions:fixtures.reduce((n,f)=>n+f.baselineExpectations,0),comparedGlobalVectors,failures}));if(failures.length)process.exitCode=1;
