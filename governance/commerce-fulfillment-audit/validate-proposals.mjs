// Proposal structural validation only. This is not an application/provider test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const baseline='2176b049dde32300e5023bcb7088d89890fec519';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),baseline,'Audit checkout must stay pinned');
const doc=JSON.parse(fs.readFileSync(path.join(here,'openapi.proposal.json'),'utf8'));
assert.equal(doc.openapi,'3.0.3');
assert.equal(doc['x-audit-baseline'],baseline);
const schemas=doc.components.schemas;
let operations=0, refs=0;
const ids=new Set();
function walk(value){
  if(!value||typeof value!=='object')return;
  if(value.$ref){
    assert.ok(value.$ref.startsWith('#/components/schemas/'));
    assert.ok(schemas[value.$ref.split('/').at(-1)],value.$ref);refs++;
  }
  for(const nested of Object.values(value))walk(nested);
}
walk(doc);
for(const [route,methods] of Object.entries(doc.paths)){
  assert.ok(route.startsWith('/api/v1/'));
  for(const [method,op] of Object.entries(methods)){
    operations++;assert.ok(!ids.has(op.operationId));ids.add(op.operationId);
    assert.equal(op['x-implementation-status'],'PROPOSAL_ONLY');
    for(const match of route.matchAll(/\{(\w+)\}/g)){
      assert.ok(op.parameters.some(p=>p.in==='path'&&p.required&&p.name===match[1]));
    }
    assert.ok(op.responses['200']);
    for(const code of [401,403,404,409,422,503])assert.ok(op.responses[code]);
    if(route.includes('/integrations/')){
      assert.equal(op['x-signature-required'],true);
      assert.equal(op['x-provider-wire-contract-pending'],true);
      assert.deepEqual(op.security,[]);
    }else{
      assert.ok(op.security.length);
      assert.ok(op['x-required-roles'].length);
      if(method!=='get')assert.ok(op.parameters.some(p=>p.in==='header'&&p.name==='Idempotency-Key'&&p.required));
    }
  }
}
assert.equal(operations,44);
assert.equal(schemas.PaymentStatus.enum.includes('AUTHORIZED'),true);
assert.equal(schemas.PaymentStatus.enum.includes('PAID'),true);
assert.equal(schemas.ShipmentStatus.enum.includes('PAID'),false);
assert.equal(schemas.InvoiceStatus.enum.includes('PAID'),false);
const adapter=fs.readFileSync(path.join(here,'ADAPTER_INTERFACES.proposal.ts'),'utf8');
for(const name of ['PaymentProviderAdapter','LogisticsProviderAdapter','InvoiceProviderAdapter','ErpAdapter','CoreCommerceEvidencePort','PosEvidencePort']){
  assert.ok(adapter.includes('interface '+name));
}
assert.ok(!/^import /m.test(adapter),'Proposal must have no Core/runtime dependencies');
stripTypeScriptTypes(adapter,{mode:'strip'}); // Parser validation, no execution or typechecking.
const plan=fs.readFileSync(path.join(here,'TEST_PLAN.md'),'utf8');
for(let n=1;n<=20;n++)assert.ok(plan.includes('| G'+String(n).padStart(2,'0')+' |'));
assert.equal(git('diff','--name-only','HEAD'),'','Existing tracked source must remain unchanged');

const scripts=['schema-preflight.mjs','migration-preflight.mjs','openapi-preflight.mjs','security-policy-preflight.mjs','test-todo-gate.mjs'];
const checks=scripts.map(script=>{
  const result=spawnSync(process.execPath,['scripts/'+script],{cwd:path.join(root,'backend'),encoding:'utf8'});
  return {command:'node scripts/'+script,exitCode:result.status,stdout:result.stdout.trim(),stderr:result.stderr.trim(),scope:'BASELINE_STATIC_ONLY'};
});
for(const check of checks)assert.equal(check.exitCode,0,check.command);
const hash=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const specFiles=fs.readdirSync(path.join(root,'governance/product-next')).sort().map(name=>'governance/product-next/'+name);
assert.equal(specFiles.length,50);
const migrations=fs.readdirSync(path.join(root,'backend/packages/database/prisma/migrations'),{withFileTypes:true})
  .filter(x=>x.isDirectory()).map(x=>'backend/packages/database/prisma/migrations/'+x.name+'/migration.sql').sort();
assert.equal(migrations.length,39);
const specManifest=specFiles.map(file=>({file,sha256:hash(file)}));
const migrationManifest=migrations.map(file=>({file,sha256:hash(file)}));
const inventory=fs.readdirSync(here).filter(x=>x!=='evidence.json').sort().map(x=>({file:'governance/commerce-fulfillment-audit/'+x,sha256:hash('governance/commerce-fulfillment-audit/'+x)}));
inventory.push({file:'governance/commerce-fulfillment-audit/evidence.json',sha256:null,note:'Self hash intentionally excluded'});
const generated=JSON.parse(fs.readFileSync(path.join(root,'backend/openapi.generated.json'),'utf8'));
const evidence={
  baseline,observedAt:new Date().toISOString(),currentBranch:'DETACHED_HEAD',newCommit:null,
  closingRemoteDelta:JSON.parse(fs.readFileSync(path.join(here,'closing-delta.json'),'utf8')),
  readiness:'B1_BLOCKED',schemaOwner:'UNCONFIRMED',coreLiveFileScope:'UNCONFIRMED',memberLiveFileScope:'UNCONFIRMED',
  sourceReview:{productNext:specManifest,originalFiledManuals:'NOT_PRESENT_IN_CHECKOUT; not independently verified'},
  schema:{file:'backend/packages/database/prisma/schema.prisma',sha256:hash('backend/packages/database/prisma/schema.prisma'),migrations:migrationManifest},
  branches:['origin/integration/member-backend-mvp','origin/codex/backend-phase3','origin/feature/member-liff-mvp'].map(branch=>({branch,sha:git('rev-parse',branch),exclusiveCountsBranchThenBaseline:git('rev-list','--left-right','--count',branch+'...HEAD')})),
  memberExclusiveChangedFiles:git('diff','--name-only','HEAD...origin/feature/member-liff-mvp').split('\n'),
  checks,
  proposalValidation:{status:'PASS',operations,schemas:Object.keys(schemas).length,resolvedRefs:refs,goldenCases:20,typescriptSyntax:'PASS (node stripTypeScriptTypes parser; not TypeScript typecheck or app build)',trackedSourceDiff:'EMPTY',fullOpenApiStandardsValidation:'NOT_RUN; local structural checks only',initialAttempt:'node --check rejected TS export in inferred CommonJS mode; replaced with explicit TS parser without executing proposal'},
  baselineOpenApiDrift:{packagePaths:Object.keys(generated.paths).filter(p=>p.includes('package')),memberOrderDtoProperties:Object.keys(generated.components.schemas.MemberCreateOrderDto.properties),status:'SOURCE_SPEC_DRIFT; preflight is incomplete'},
  execution:{build:'NOT_RUN',prismaGenerate:'NOT_RUN',migrationFromZero:'NOT_RUN',unit:'NOT_RUN',integration:'NOT_RUN',http:'NOT_RUN',dbAssertions:'NOT_RUN',concurrency:'NOT_RUN',rbac:'NOT_RUN',providerMock:'NOT_RUN',providerSandboxUat:'NOT_VERIFIED',production:'NOT_READY'},
  changedFiles:inventory
};
fs.writeFileSync(path.join(here,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({proposalValidation:evidence.proposalValidation,baselineStaticChecks:checks.map(x=>({command:x.command,exitCode:x.exitCode})),productNextFiles:specFiles.length,migrations:migrations.length,artifacts:inventory.length,readiness:evidence.readiness},null,2));
