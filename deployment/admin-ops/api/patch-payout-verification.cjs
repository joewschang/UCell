// Keep the production package's other audit operations and replace the verified method only.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const {createRequire} = require('node:module');
const path = require('node:path');
const runner = '/app/packages/database/dist/compensation-audit-runner.js';
const requireApi = createRequire('/app/apps/api/dist/main.js');
const ts = requireApi('typescript');
function method(source) {
  const start = source.indexOf('async function verifyPayoutSources(');
  const end = source.indexOf('function auditPeriodId(', start);
  assert(start >= 0 && end > start && source.indexOf('async function verifyPayoutSources(', start+1)===-1);
  return source.slice(start,end);
}
async function install() {
  const installed = fs.readFileSync(runner, 'utf8');
  const previous = method(installed);
  assert.equal(createHash('sha256').update(previous).digest('hex'), 'b8fa683c7281ed9bc33b9757f70c5d5536e5d69603d6a62267ffb417de580296');
  const source = fs.readFileSync(path.join(__dirname,'compensation-audit-runner.ts'),'utf8');
  const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  fs.writeFileSync(runner,installed.replace(previous,()=>method(compiled)));
  const {Prisma,verifyPayoutSources} = requireApi('@ucell/database');
  assert.equal(verifyPayoutSources,require(runner).verifyPayoutSources);
  const zero = new Prisma.Decimal(0),amount = new Prisma.Decimal(125);
  const batch = {totalGross:amount,totalRecovery:zero,totalNet:amount};
  const line = {grossAmount:amount,recoveryOffset:zero,netAmount:amount,recipientQualificationId:'test-recipient',payableEntries:[],recoveryApplications:[]};
  const tx = {payoutBatch:{findUniqueOrThrow:async()=>batch},payoutLine:{findMany:async()=>[line]}};
  await assert.rejects(()=>verifyPayoutSources(tx,'test-batch'),/付款明細的來源總額/);
  line.payableEntries.push({grossAmount:amount,qualificationId:'wrong-recipient',status:'ALLOCATED'});
  await assert.rejects(()=>verifyPayoutSources(tx,'test-batch'),/受領資格/);
  console.log('Production payout export rejects missing and misassigned sources.');
}
install().catch(error=>{console.error(error);process.exitCode=1;});
