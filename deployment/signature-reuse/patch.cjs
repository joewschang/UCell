const fs=require('node:fs'),file='/app/apps/api/dist/modules/member/formal-member-application.service.js',policy='require("./signature-reuse.cjs").sameSignerAndContract';
let s=fs.readFileSync(file,'utf8');
function replace(before,after){if(s.split(before).length!==2)throw Error('Unexpected signature workflow near '+before);s=s.replace(before,()=>after)}
for(const [id,owner,condition] of [['current.formalMemberApplicationId','current',policy+'(this.pii.decrypt(current.snapshots[0].payloadCiphertext,current.snapshots[0].keyVersion),normalized)'],['applicationId','app',policy+'(original,payload)']]){
 const clear="await tx.formalApplicationDocument.updateMany({ where: { formalMemberApplicationId: "+id+", documentType: 'SIGNED_APPLICATION_AGREEMENT', status: 'PRESENT' }, data: { status: 'SUPERSEDED' } });";
 replace(clear,'const keepSignature='+condition+'; if(!keepSignature) '+clear);
 const clearPaper="await tx.formalPaperEvidence.updateMany({ where: { formalMemberApplicationId: "+id+" }, data: { status: 'PENDING', reviewedBy: null, reviewedAt: null, note:";
 replace(clearPaper,clearPaper.replace(id+' },',id+", ...(keepSignature?{evidenceType:{not:'SIGNED_APPLICATION_AGREEMENT'}}:{}) },"));
}
fs.writeFileSync(file,s);
