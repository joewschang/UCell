const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out='C:/UCell/ball-at-creation-20261023';
let runtime=fs.readFileSync(out+'/live-base/order.service.js','utf8');
const anchor='                    qualificationId = qualification.qualificationId;';
assert.equal(runtime.split(anchor).length,2);
runtime=runtime.replace(anchor,anchor+'\n                    await require("../qualification/allocate-created-ball").allocateCreatedBall(tx, qualificationId, sponsorEvidence?.sponsorQualificationId);');
for(const target of [out+'/api',root+'/deployment/releases/ball-at-creation-20261023']){
 fs.mkdirSync(target+'/overlay/modules/order',{recursive:true});
 fs.mkdirSync(target+'/overlay/modules/qualification',{recursive:true});
 fs.writeFileSync(target+'/overlay/modules/order/order.service.js',runtime);
 fs.copyFileSync(root+'/backend/apps/api/dist/modules/qualification/allocate-created-ball.js',target+'/overlay/modules/qualification/allocate-created-ball.js');
}
fs.writeFileSync(out+'/api/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:519e8052850efc8b8e1facf5e92b972560233f496467112cd649f52beb0c7b79\nCOPY overlay/ /app/apps/api/dist/\n');
fs.mkdirSync(out+'/admin',{recursive:true});fs.cpSync(root+'/admin/dist',out+'/admin/dist',{recursive:true});
fs.writeFileSync(out+'/admin/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:86ae5a9058ca35e9c1180e649a9157ac61e1461fd3650f0590e8dd69575ac922\nCOPY dist/ /usr/share/nginx/html/\n');
fs.mkdirSync(out+'/member',{recursive:true});
const memberDist=root+'/member/dist';
fs.cpSync(memberDist,out+'/member/dist',{recursive:true,filter:p=>!path.relative(memberDist,p).split(path.sep).includes('ocr')});
fs.writeFileSync(out+'/member/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:59ab4429df2b251aaf93edf60f690fd1cd3c601a4a273c1e40ab815d0835f63c\nCOPY dist/ /usr/share/nginx/html/\n');
