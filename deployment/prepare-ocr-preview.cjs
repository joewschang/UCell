const fs=require('fs'),path=require('path'),assert=require('assert/strict');const root=path.resolve(__dirname,'..'),out='C:/UCell/ocr-preview-20261023',ts=require(root+'/backend/node_modules/typescript');
function method(s,name){const f=ts.createSourceFile('file.js',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let found;function visit(n){if(ts.isMethodDeclaration(n)&&n.name?.getText(f)===name)found=n.getText(f);ts.forEachChild(n,visit)}visit(f);assert(found);return found;}
for(const [file,name,anchor] of [['formal-kyc-document.service','ownContent','adminContent'],['member.controller','formalDocumentContent','formalDocuments']]){
 let s=fs.readFileSync(out+'/live-base/'+file+'.js','utf8'),built=fs.readFileSync(root+'/backend/apps/api/dist/modules/member/'+file+'.js','utf8');
 const old=method(s,anchor);assert(!s.includes(name+'('));s=s.replace(old,method(built,name)+'\n    '+old);
 if(file==='member.controller'){
  const end=built.indexOf('], MemberController.prototype, "'+name+'", null);')+('], MemberController.prototype, "'+name+'", null);').length;
  const start=built.lastIndexOf('__decorate([',end-1);const block=built.slice(start,end);assert(block.includes('common_1.Get'));
  const pos=s.indexOf('__decorate([',s.indexOf('exports.MemberController = MemberController;'));assert(pos>0);s=s.slice(0,pos)+block+'\n'+s.slice(pos);
 }
 for(const base of [out+'/api',root+'/deployment/releases/ocr-preview-20261023']){fs.mkdirSync(base+'/overlay/modules/member',{recursive:true});fs.writeFileSync(base+'/overlay/modules/member/'+file+'.js',s);}
}
{
 const file='member-context.guard.js';let s=fs.readFileSync(out+'/live-base/'+file,'utf8');
 const anchor='const request = context.switchToHttp().getRequest(), path = request.url.split(\'?\')[0];';assert.equal(s.split(anchor).length,2);
 s=s.replace(anchor,anchor+"\n        if (request.method === 'GET' && /^\\/api\\/v1\\/member\\/formal-applications\\/[0-9a-f-]{36}\\/documents\\/[0-9a-f-]{36}\\/content$/i.test(path)) return true;");
 for(const base of [out+'/api',root+'/deployment/releases/ocr-preview-20261023'])fs.writeFileSync(base+'/overlay/modules/member/'+file,s);
}
fs.writeFileSync(out+'/api/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:c7232c3e0f4ec03ebca447230ed23feb21c84a828f13f0adc1ae7d6113f27237\nCOPY overlay/ /app/apps/api/dist/\n');
for(const [app,digest] of [['admin','5c3bc0b4911a1e81213de34a9f8550da969f76ffa696455f5bf74e2e6e93bb2f'],['member','50feb056fbd3822d990d8d06e50f92172ecd079513f9198f493e839a59a1ee1b']]){const dest=out+'/'+app;fs.mkdirSync(dest,{recursive:true});fs.cpSync(root+'/'+app+'/dist',dest+'/dist',{recursive:true});fs.writeFileSync(dest+'/Dockerfile',`FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-${app}@sha256:${digest}\nCOPY dist/ /usr/share/nginx/html/\n`);}
console.log('Prepared exact-base additive API overlay and frontend releases.');
