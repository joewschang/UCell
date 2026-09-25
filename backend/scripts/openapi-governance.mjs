import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const methods=['get','put','post','delete','options','head','patch','trace'];
export const requiredGates=['generated','secretScan','validation','breakingDiff','contractTests','securityTests','publisherTests'];
export const sha256=x=>createHash('sha256').update(x).digest('hex');
export function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
export function inventory(bytes){
 const s=JSON.parse(bytes.toString());
 return {version:s.info.version,pathCount:Object.keys(s.paths).length,operationCount:Object.values(s.paths).reduce((n,p)=>n+methods.filter(m=>p[m]).length,0),schemaCount:Object.keys(s.components?.schemas??{}).length,artifactSha256:sha256(bytes),canonicalSha256:sha256(canonical(s))};
}
const sensitive=/(?:password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key)/i;
export function scan(spec,secrets=[]){
 function walk(v,key='',example=false,credential=false){
  credential=credential||sensitive.test(key);
  if(example&&credential&&v!==null&&typeof v!=='object'&&v!==''&&v!=='[REDACTED]')throw Error('OPENAPI_CREDENTIAL_EXAMPLE_FAIL');
  if(typeof v==='string'){
   if(/SECRET_NEVER_AI|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]+)|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:Bearer|Basic)\s+[A-Za-z0-9+/_=-]{8,}|(?:password|secret|token|api[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{6,}|https?:\/\/[^\s/]+:[^\s/@]+@/i.test(v)||secrets.some(s=>s&&v.includes(s)))throw Error('OPENAPI_SECRET_SCAN_FAIL');
   if(example&&v&&v!=='[REDACTED]'&&!/^(?:[0-9]{1,6}(?:\.[0-9]{1,2})?|identity\.person\.status|membership\.qualification\.status|\+886912345678|TW|BANK_TRANSFER|REPURCHASE|CONNECTED_DEV|UAT-R6-001|王小明)$/.test(v))throw Error('OPENAPI_LITERAL_EXAMPLE_FAIL');
   if(sensitive.test(key)&&v&&v!=='[REDACTED]')throw Error('OPENAPI_CREDENTIAL_VALUE_FAIL');
   if(key==='$ref'&&!v.startsWith('#/'))throw Error('OPENAPI_EXTERNAL_REF_FORBIDDEN');
   if(key==='externalValue')throw Error('OPENAPI_EXTERNAL_EXAMPLE_FORBIDDEN');
  }else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))walk(x,k,example||['example','examples','default'].includes(k),credential);
 }
 if(JSON.stringify(spec).includes('SECRET_NEVER_AI'))throw Error('OPENAPI_SECRET_SCAN_FAIL');
 walk(spec);
 if(!spec.openapi?.startsWith('3.0.')||!/^1\.\d+\.\d+$/.test(spec.info?.version??''))throw Error('OPENAPI_V1_VERSION_REQUIRED');
 if(!Object.keys(spec.paths??{}).length||Object.keys(spec.paths).some(p=>!p.startsWith('/api/v1/')))throw Error('OPENAPI_V1_PREFIX_REQUIRED');
}
// Comparison-only normalization; never rewrite the approved/source artifact.
// Header names are case-insensitive. URI placeholders were always mandatory.
export function comparisonView(spec){
 const copy=structuredClone(spec);
 for(const [route,item] of Object.entries(copy.paths)){
  for(const operation of [item,...methods.map(m=>item[m]).filter(Boolean)]){
   const seen=new Map();
   operation.parameters=(operation.parameters??[]).filter(p=>{
    if(p.in!=='header')return true;
    p.name=p.name.toLowerCase();const key=p.name;
    if(seen.has(key)){
     if(canonical(seen.get(key))!==canonical(p))throw Error('CONFLICTING_HEADER_DEFINITIONS');
     return false;
    }
    seen.set(key,p);return true;
   });
  }
  for(const method of methods){
   const op=item[method];if(!op)continue;
   for(const match of route.matchAll(/\{([^}]+)\}/g)){
    const name=match[1];
    if(![...(item.parameters??[]),...op.parameters].some(p=>p.in==='path'&&p.name===name))op.parameters.push({name,in:'path',required:true,schema:{type:'string'}});
   }
  }
 }
 return copy;
}
export function assertSecurityCompatibility(base,candidate){
 for(const [route,item]of Object.entries(base.paths))for(const method of methods){
  if(!item[method]||!candidate.paths[route]?.[method])continue;
  const before=item[method].security??base.security??[];
  const after=candidate.paths[route][method].security??candidate.security??[];
  if(before.length&&canonical(before)!==canonical(after))throw Error('OPENAPI_SECURITY_CONTRACT_CHANGED');
 }
}
export function verifyGates(e,bytes,baseline,commit){
 if(e.executionContext!=='github-actions'||e.status!=='PASS'||requiredGates.some(g=>e.gates?.[g]!=='PASS'))throw Error('PUBLISH_GATES_NOT_PASS');
 if(e.commit!==commit||canonical(e.generated)!==canonical(inventory(bytes))||e.baselineSha256!==sha256(baseline))throw Error('PUBLISH_EVIDENCE_BINDING_FAIL');
}
export async function request(url,options={}, {fetchFn=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(new URL(url).origin!=='https://api.swaggerhub.com')throw Error('PUBLISH_DESTINATION_FORBIDDEN');
 for(let n=0;n<4;n++){
  let r;
  try{r=await fetchFn(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});}
  catch{if(n===3)throw Error('SWAGGERHUB_NETWORK_FAILURE');}
  if(r?.ok||r?.status===404)return r;
  if(r&&![408,429,500,502,503,504].includes(r.status))throw Error('SWAGGERHUB_HTTP_'+r.status);
  if(n===3)throw Error('SWAGGERHUB_RETRY_EXHAUSTED');
  const retry=Number(r?.headers?.get('retry-after'));
  await sleep(Math.min(5000,Math.max(250*2**n,Number.isFinite(retry)?retry*1000:0)));
 }
}
export async function publish({bytes,baseline,evidence,commit,key,policy,requestFn=request,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 verifyGates(evidence,bytes,baseline,commit);
 const spec=JSON.parse(bytes);scan(spec,[key]);
 if(!key)throw Error('SWAGGERHUB_CI_SECRET_MISSING');
 if(policy.owner!=='ragetech'||policy.api!=='ucell-api'||policy.visibility!=='private')throw Error('PUBLISH_POLICY_INVALID');
 const version=spec.info.version, api='https://api.swaggerhub.com/apis/ragetech/ucell-api', endpoint=api+'/'+encodeURIComponent(version);
 const headers={Authorization:key,Accept:'application/json'};
 async function visibility(){
  const r=await requestFn(endpoint+'/settings/private',{headers});
  if(r.status===404)return null;
  if((await r.json()).private!==true)throw Error('SWAGGERHUB_NOT_PRIVATE');
  return true;
 }
 let previousArtifactSha256=null, previousCanonicalSha256=null;
 if(await visibility()){
  const r=await requestFn(endpoint,{headers});
  if(r.status===404)throw Error('SWAGGERHUB_INCONSISTENT_STATE');
  const prior=await r.text(),remote=JSON.parse(prior);scan(remote,[key]);
  previousArtifactSha256=sha256(prior);previousCanonicalSha256=sha256(canonical(remote));
 }
 const r=await requestFn(api+'?version='+encodeURIComponent(version)+'&isPrivate=true&force=false',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:bytes});
 if(!r.ok)throw Error('SWAGGERHUB_UPLOAD_FAILED');
 let published;
 for(let n=0;n<4;n++){
  if(await visibility()!==true)throw Error('SWAGGERHUB_VISIBILITY_VERIFY_FAIL');
  const r=await requestFn(endpoint,{headers});
  if(r.status!==404){
   const raw=await r.text(),received=JSON.parse(raw);scan(received,[key]);
   if(canonical(received)===canonical(spec)){published={version,artifactSha256:sha256(raw),canonicalSha256:sha256(canonical(received)),private:true};break;}
  }
  if(n<3)await sleep(500);
 }
 if(!published)throw Error('SWAGGERHUB_READBACK_MISMATCH');
 return {status:'PASS',commit,runId:process.env.GITHUB_RUN_ID??null,verifiedAt:new Date().toISOString(),generated:inventory(bytes),published,previousArtifactSha256,previousCanonicalSha256,cloudDifferedBeforeUpload:previousCanonicalSha256!==null&&previousCanonicalSha256!==sha256(canonical(spec)),url:'https://app.swaggerhub.com/apis/ragetech/ucell-api/'+version};
}
const load=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(load(p));
const out=path.join(root,'governance/swaggerhub/evidence');
function save(name,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');}
function command(exe,args,cwd=path.join(root,'backend')){
 const r=spawnSync(exe,args,{cwd,stdio:'inherit',env:process.env,shell:process.platform==='win32'&&exe.endsWith('.cmd')});
 if(r.error||r.status!==0)throw Error('OPENAPI_GATE_COMMAND_FAILED');
}
function oasdiff(){
 const exe=process.env.OASDIFF_BIN;
 if(!exe)throw Error('PINNED_OASDIFF_BIN_REQUIRED');
 const r=spawnSync(exe,['--version'],{encoding:'utf8'});
 if(r.status!==0||!r.stdout.includes('1.32.1'))throw Error('OASDIFF_VERSION_MISMATCH');
 return exe;
}
export async function main(mode){
 const policy=json('governance/swaggerhub/policy.json'), specPath=path.join(root,'backend/openapi.generated.json'), baselinePath=path.join(root,'governance/swaggerhub/baseline.openapi.json'),baseline=fs.readFileSync(baselinePath);
 if(sha256(baseline)!==policy.baselineSha256)throw Error('APPROVED_BASELINE_HASH_MISMATCH');
 const commit=process.env.GITHUB_SHA??spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
 if(mode==='gate'){
  const report={status:'FAIL',commit,executionContext:process.env.GITHUB_ACTIONS==='true'?'github-actions':'local-working-tree',gates:{},baselineSha256:sha256(baseline)};
  try{
   command(process.platform==='win32'?'pnpm.cmd':'pnpm',['openapi']);report.gates.generated='PASS';
   const bytes=fs.readFileSync(specPath);scan(JSON.parse(bytes));scan(JSON.parse(baseline));report.gates.secretScan='PASS';report.generated=inventory(bytes);
   command(process.execPath,['scripts/openapi-preflight.mjs']);
   const exe=oasdiff(),config=path.join(root,'governance/swaggerhub/oasdiff.yaml');
   command(exe,['validate',specPath,'--allow-external-refs=false','--fail-on','ERR','--config',config]);report.gates.validation='PASS';
   const comparisonBase=path.join(out,'comparison-baseline.json'),comparisonCurrent=path.join(out,'comparison-current.json');
   save('comparison-baseline.json',comparisonView(JSON.parse(baseline)));save('comparison-current.json',comparisonView(JSON.parse(bytes)));
   report.comparison={normalization:'case-insensitive identical header deduplication; inferred missing URI placeholder declarations',baselineSha256:sha256(fs.readFileSync(comparisonBase)),candidateSha256:sha256(fs.readFileSync(comparisonCurrent))};
   const diff=spawnSync(exe,['breaking',comparisonBase,comparisonCurrent,'--allow-external-refs=false','--include-path-params','--fail-on','WARN','--format','json','--config',config],{encoding:'utf8'});
   if(diff.error||![0,1].includes(diff.status))throw Error('OPENAPI_DIFF_TOOL_FAILURE');
   save('breaking-diff.json',JSON.parse(diff.stdout||'[]'));
   assertSecurityCompatibility(JSON.parse(baseline),JSON.parse(bytes));
   if(diff.status!==0)throw Error('UNAPPROVED_BREAKING_CHANGE');report.gates.breakingDiff='PASS';
   command(process.execPath,['--test','scripts/openapi-governance.test.mjs']);report.gates.publisherTests='PASS';
   command(process.execPath,['scripts/test-todo-gate.mjs']);
   command(process.execPath,['scripts/security-policy-preflight.mjs']);
   command(process.execPath,['scripts/api-jest-isolated.mjs']);
   report.gates.contractTests='PASS';report.gates.securityTests='PASS';
   if(sha256(fs.readFileSync(specPath))!==report.generated.artifactSha256)throw Error('GENERATED_ARTIFACT_CHANGED_DURING_GATES');
   report.status='PASS';
  }catch(e){report.errorCode=/^[A-Z0-9_]+$/.test(e.message)?e.message:'OPENAPI_GATE_FAILED';throw e;}finally{save('gates.json',report);}
  return;
 }
 if(mode==='publish'){
  let result={status:'FAIL',commit,published:null};
  try{
   if(process.env.GITHUB_ACTIONS!=='true'||!['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)||process.env.GITHUB_REF!=='refs/heads/'+process.env.DEFAULT_BRANCH)throw Error('PUBLISH_TRUSTED_BRANCH_REQUIRED');
   result=await publish({bytes:load('backend/openapi.generated.json'),baseline,evidence:json('governance/swaggerhub/evidence/gates.json'),commit,key:process.env.SWAGGERHUB_API_KEY,policy});
  }catch(e){result.errorCode=/^[A-Z0-9_]+$/.test(e.message)?e.message:'SWAGGERHUB_PUBLISH_FAILURE';throw Error(result.errorCode);}
  finally{
   save('publication.json',result);
   fs.mkdirSync(path.join(root,'backend/release'),{recursive:true});
   fs.writeFileSync(path.join(root,'backend/release/SWAGGERHUB_SYNC_EVIDENCE.json'),JSON.stringify(result,null,2)+'\n');
   fs.writeFileSync(path.join(out,'OPENAPI_CONTRACT_REPORT.md'),'# OpenAPI contract publication\n\n'+JSON.stringify(result,null,2)+'\n');
  }
  return;
 }
 if(mode==='release-check'){
  const r=json('backend/release/SWAGGERHUB_SYNC_EVIDENCE.json'),bytes=load('backend/openapi.generated.json');
  if(r.status!=='PASS'||r.commit!==commit||canonical(r.generated)!==canonical(inventory(bytes))||r.published?.private!==true||r.published?.version!==JSON.parse(bytes).info.version||r.generated?.canonicalSha256!==r.published?.canonicalSha256||!/^[a-f0-9]{64}$/.test(r.published?.artifactSha256??''))throw Error('SWAGGERHUB_RELEASE_EVIDENCE_MISSING_OR_STALE');
  console.log('SWAGGERHUB_SYNC_PASS');return;
 }
 throw Error('UNKNOWN_GOVERNANCE_MODE');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv[2]).catch(e=>{console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'OPENAPI_GOVERNANCE_FAIL');process.exitCode=1;});
