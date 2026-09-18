import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {root,sha256} from './openapi-governance.mjs';
import path from 'node:path';
const base=process.env.BASE_SHA;
const paths=['governance/swaggerhub/baseline.openapi.json','governance/swaggerhub/oasdiff.yaml'];
const ref=base&&/^[a-f0-9]{40}$/.test(base)&&!/^0+$/.test(base)?base:'HEAD';
for(const file of paths){
 const prior=spawnSync('git',['show',ref+':'+file],{cwd:root});
 if(prior.status!==0){
  const exists=spawnSync('git',['cat-file','-e',ref+'^{commit}'],{cwd:root});
  if(exists.status!==0)throw Error('BASELINE_REVIEW_REF_UNAVAILABLE');
  // Bootstrap only: creation is subject to CODEOWNERS/protected-branch review.
  continue;
 }
 if(!prior.stdout.equals(fs.readFileSync(path.join(root,file))))throw Error('BASELINE_CHANGE_REQUIRES_SEPARATE_GOVERNANCE_REVIEW');
}
const p=JSON.parse(fs.readFileSync(path.join(root,'governance/swaggerhub/policy.json'),'utf8'));
if(sha256(fs.readFileSync(path.join(root,paths[0])))!==p.baselineSha256)throw Error('BASELINE_HASH_MISMATCH');
console.log('BASELINE_REVIEW_BOUNDARY_PASS');
