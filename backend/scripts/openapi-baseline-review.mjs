import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {root,sha256} from './openapi-governance.mjs';
import path from 'node:path';
const base=process.env.BASE_SHA;
const baselinePath='governance/swaggerhub/baseline.openapi.json';
const configPath='governance/swaggerhub/oasdiff.yaml';
const promotionManifestPath='governance/swaggerhub/baseline-promotions.json';
const ref=base&&/^[a-f0-9]{40}$/.test(base)&&!/^0+$/.test(base)?base:'HEAD';
const atRef=file=>spawnSync('git',['show',ref+':'+file],{cwd:root,encoding:null});
const current=file=>fs.readFileSync(path.join(root,file));
const previousBaseline=atRef(baselinePath);
const previousConfig=atRef(configPath);
if(previousConfig.status===0&&!previousConfig.stdout.equals(current(configPath))) throw Error('BASELINE_CHANGE_REQUIRES_SEPARATE_GOVERNANCE_REVIEW');
if(previousBaseline.status!==0){
 const exists=spawnSync('git',['cat-file','-e',ref+'^{commit}'],{cwd:root});
 if(exists.status!==0)throw Error('BASELINE_REVIEW_REF_UNAVAILABLE');
}else if(!previousBaseline.stdout.equals(current(baselinePath))){
 const oldHash=sha256(previousBaseline.stdout),newHash=sha256(current(baselinePath));
 const manifest=JSON.parse(current(promotionManifestPath));
 const entry=(manifest.promotions??[]).find(x=>x.previousBaselineSha256===oldHash&&x.newBaselineSha256===newHash&&x.phase==='PRE_GA');
 if(!entry||!entry.decisionDocument||!entry.archivedBaseline||!entry.approvingDecision||!entry.approvalDate||!entry.candidateHead) throw Error('BASELINE_PROMOTION_DECISION_REQUIRED');
 const archived=path.join(root,entry.archivedBaseline),decision=path.join(root,entry.decisionDocument);
 if(!fs.existsSync(archived)||sha256(fs.readFileSync(archived))!==oldHash||!fs.existsSync(decision))throw Error('BASELINE_PROMOTION_EVIDENCE_INVALID');
 const decisionText=fs.readFileSync(decision,'utf8');
 if(!decisionText.includes(oldHash)||!decisionText.includes(newHash)||!decisionText.includes(entry.candidateHead))throw Error('BASELINE_PROMOTION_DECISION_BINDING_FAIL');
}
const p=JSON.parse(current('governance/swaggerhub/policy.json'));
if(sha256(current(baselinePath))!==p.baselineSha256)throw Error('BASELINE_HASH_MISMATCH');
console.log('BASELINE_REVIEW_BOUNDARY_PASS');
