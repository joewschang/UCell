import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..');
const dir=path.join(root,'governance/ux-v2');
const errors=[];
const required=['UX_AUDIT','INFORMATION_ARCHITECTURE','COMPONENT_SPEC','PAGE_MAPPING','TERMINOLOGY_AUDIT','MULTI_TREE_COMPANY_BALL_SPEC','BINARY_TREE_ADMIN_AND_STATISTICS_SPEC','ARCHITECTURE_GAP_ANALYSIS','MIGRATION_43_PLUS_PROPOSAL','API_V2_PROPOSAL','PENDING_ARCHITECTURE_DECISIONS','MANAGEMENT_ANALYTICS_AND_BI_SPEC','AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC','AI_READY_FOUNDATION_SPEC','PHASE1_ARCHITECTURE_REVIEW_REPORT','VERIFICATION'];
for(const name of required) if(!fs.existsSync(path.join(dir,name+'.md'))) errors.push('missing '+name);
let links=0;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.md'))){
 for(const m of fs.readFileSync(path.join(dir,f),'utf8').matchAll(/\]\(([^)]+)\)/g)){
  const link=m[1].split('#')[0];
  if(!link||/^[a-z]+:|^\//i.test(link)) continue;
  links++;
  if(!fs.existsSync(path.resolve(dir,link)))errors.push(f+' broken link '+link);
 }
}
const manifest=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'source-manifest.json'),'utf8'));
for(const f of manifest.files){
 const hash=createHash('sha256').update(fs.readFileSync(path.join(root,f.file))).digest('hex');
 if(hash!==f.sha256) errors.push('changed baseline source '+f.file);
}
const changed=execFileSync('git',['diff',manifest.baseline,'--name-only'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
for(const f of changed)if(!f.startsWith('governance/ux-v2/'))errors.push('outside authorized scope '+f);
const golden=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'AI_GOLDEN_QUESTIONS.json'),'utf8'));
for(const c of golden.cases)for(const k of ['question','locale','intent','selectedContext','requiredTool','allowedScope','forbiddenScope','expectedEvidence','expectedDeepLink','failClosed','assertions'])if(c[k]===undefined)errors.push('golden missing '+c.id+'/'+k);
const result={status:errors.length?'FAIL':'PASS',baseline:manifest.baseline,requiredDocuments:required.length,relativeLinks:links,protectedHashes:manifest.files.length,seedCases:golden.cases.length,errors};
console.log(JSON.stringify(result,null,2));
process.exitCode=errors.length?1:0;
