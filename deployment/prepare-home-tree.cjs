const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out='C:/UCell/home-tree-20261023';
function methodSlice(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);assert(a>=0&&b>a);return s.slice(a,b);}
const files=[['binary-tree/binary-tree-read.service','    time(raw)','    async list('],['admin-observability/admin-observability.service','    async sponsorTree(','    async qualificationOperations(']];
for(const [file,start,end] of files){
 const base=fs.readFileSync(out+'/live-base/'+path.basename(file)+'.js','utf8');
 const built=fs.readFileSync(root+'/backend/apps/api/dist/modules/'+file+'.js','utf8');
 const overlay=base.replace(methodSlice(base,start,end),methodSlice(built,start,end));
 for(const dest of [out+'/api',root+'/deployment/releases/home-tree-20261023']){
  const target=dest+'/overlay/modules/'+file+'.js';fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,overlay);
 }
}
fs.writeFileSync(out+'/api/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:cb34890861806d5d09772d4121ee691140e25950b30c739a7ea2922a7aaf8b16\nCOPY overlay/ /app/apps/api/dist/\n');
for(const [app,digest] of [['admin','sha256:8c0d7fc6aa6c381afe96370f7825fd02f3b0823e98bd2afe5595e9b7ec814f72'],['member','sha256:2b4d445907fbaf2eed3e382a34c58fb543703d6217ca5e237515e026652ba7d9']]){
 const src=root+'/'+app+'/dist',dest=out+'/'+app;fs.mkdirSync(dest,{recursive:true});
 fs.cpSync(src,dest+'/dist',{recursive:true,filter:p=>!path.relative(src,p).split(path.sep).includes('ocr')});
 fs.writeFileSync(dest+'/Dockerfile',`FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-${app}@${digest}\nCOPY dist/ /usr/share/nginx/html/\n`);
}
