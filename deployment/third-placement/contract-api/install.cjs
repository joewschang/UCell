'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const digests={
  'member.module':'e1e8f1a5c88d1b747578abe75c634d63cdcc568b17cbdc42207275e98403db06',
  'formal-kyc-document.service':'163318e868a8fd8322e618a94138fa42ae7fa8aa003991f3faee5f5d14ebcedf',
  'formal-enrollment.service':'5db5411b1a68fb2014585196359e7b1778f6d24959d82da31131b7f63992ee4b',
  'formal-member-application.service':'a86a338bdffe9de84cc56f1f043f1e422595bd688b2d1eac50266de9e9069167',
  'paper-reconfirmation':'870b5091925372e68b92dce7b984e7c753c0f29bb36122146095725cd18254f5',
};
function patch(unit,s){
  assert.equal(require('node:crypto').createHash('sha256').update(s).digest('hex'),digests[unit],unit+' drift');
  function replace(anchor,withText,count=1){assert.equal(s.split(anchor).length,count+1,unit+': '+anchor);s=s.replaceAll(anchor,withText);}
  const core='require("./contract-renewal")';
  if(unit==='member.module')replace('controllers: [','controllers: [require("./contract-renewal.controller").MemberContractRenewalController,require("./contract-renewal.controller").AdminContractRenewalController, ');
  if(unit==='formal-kyc-document.service'){
    replace('return { applicationId, paperReviewed:', 'const contractRenewal=await '+core+'.signingRenewalView(this.db,applicationId,personId); if(snapshot?.payloadHash!==contractRenewal.snapshotHash || app.currentSnapshotHash!==contractRenewal.snapshotHash) throw new common_1.ConflictException({code:"FORMAL_APPLICATION_VERSION_CONFLICT"}); return { applicationId,contractRenewal,paperReviewed:');
    replace('signingContext: contract ?','signingContext: contract && !contractRenewal.requiresRefresh ?');
    const anchor="if (type === 'SIGNED_APPLICATION_AGREEMENT' && (!expectedSnapshotHash";
    replace(anchor,"if(type==='SIGNED_APPLICATION_AGREEMENT') await "+core+".checkContract(tx,applicationId,'sign');\n                "+anchor);
  }
  if(unit==='formal-enrollment.service'){
    const anchor='const contractVersionId = latest ?';
    replace(anchor,"await "+core+".checkContract(tx,applicationId,'submit');\n            "+anchor);
  }
  if(unit==='formal-member-application.service'){
    const anchor='if (current?.currentSnapshotHash === hash)';
    replace(anchor,'const unchanged=await '+core+'.priorUnchanged(tx,current,normalized); if(unchanged)return this.view(current,unchanged,current.snapshots[0].version);\n                '+anchor);
    const paper='const row = await tx.formalPaperEvidence.upsert(';
    replace(paper,'if(evidenceType==="SIGNED_APPLICATION_AGREEMENT" && decision==="REVIEWED"){await tx.$queryRaw`SELECT formal_member_application_id FROM identity.formal_member_application WHERE formal_member_application_id=${applicationId}::uuid FOR UPDATE`; await '+core+'.checkContract(tx,applicationId,"sign");}\n            '+paper);
    const gate='const gate = await this.evidenceGate(applicationId, tx);';
    replace(gate,'await '+core+'.checkContract(tx,applicationId,"submit");\n                '+gate,2);
    const invalidate='if (hash !== previous.payloadHash) {';
    replace(invalidate,'if(hash===previous.payloadHash && (input.paperApplicationReference===undefined || (input.paperApplicationReference.trim()||null)===app.paperApplicationReference))return {applicationId,version:previous.version,status:app.status};\n                const renewalAfterEdit=await '+core+'.amendmentNeedsSignature(tx,applicationId,previous.payloadHash,hash);\n                '+invalidate);
    const status="status: app.status === 'UNDER_REVIEW' ? 'SUBMITTED' : app.status,";
    replace(status,'...(renewalAfterEdit && ["SUBMITTED","UNDER_REVIEW"].includes(app.status)?{status:"NEEDS_MORE_INFO",decisionReasonCode:"FORMAL_CONTRACT_REFRESH_REQUIRED"}:{'+status+'}),');
  }
  if(unit==='paper-reconfirmation'){
    const anchor="if (action === 'view') {";
    replace(anchor,'if(action==="submit") await '+core+'.checkContract(tx,id,"submit");\n        '+anchor);
  }
  return s;
}
function install(dir,release){
  const writes=Object.keys(digests).map(unit=>{const file=path.join(dir,unit+'.js');return [file,patch(unit,fs.readFileSync(file,'utf8'))];});
  for(const unit of ['contract-renewal','contract-renewal.controller'])fs.copyFileSync(path.join(release,unit+'.js'),path.join(dir,unit+'.js'));
  for(const [file,s] of writes)fs.writeFileSync(file,s);
}
module.exports={patch,install,digests};
if(require.main===module)install('/app/apps/api/dist/modules/member',__dirname);
