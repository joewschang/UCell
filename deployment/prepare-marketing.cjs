const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out='C:/UCell/marketing-20261023';
function replace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
function save(name,s){for(const base of [out+'/api',root+'/deployment/releases/marketing-20261023']){const p=base+'/overlay/modules/content/'+name;fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)}}
let name='content.module.js',s=fs.readFileSync(out+'/live-base/'+name,'utf8');
s=replace(s,'const common_1 =',`const marketing_module_1 = require('./marketing.module');\nconst common_1 =`);
s=replace(s,'imports: [auth_module_1.AuthModule]','imports: [auth_module_1.AuthModule, marketing_module_1.MarketingModule]');save(name,s);
name='content-insights.controller.js';s=fs.readFileSync(out+'/live-base/'+name,'utf8');
s=replace(s,"('SUPER_ADMIN', 'ORDER_OPS', 'COMPLIANCE_AUDIT')","('SUPER_ADMIN', 'MEMBERSHIP_OPS', 'ORDER_OPS', 'COMPLIANCE_AUDIT')");save(name,s);
for(const f of ['marketing.service.js','marketing.controller.js','marketing.module.js'])save(f,fs.readFileSync(root+'/backend/apps/api/dist/modules/content/'+f,'utf8'));
fs.writeFileSync(out+'/api/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:00c50f8a040806d00419236f76747844b1a81827409f0cb5bdf9024199140e67\nCOPY overlay/ /app/apps/api/dist/\n');
const digests={admin:'7340317c833d14b82c36be010e01523dc1e3e5a096387951cb719ae872de94dd',member:'10981fac1655c1ca242f81768924da9f79fd536a0b94bdc2ee9c134f8b626d32'};
for(const app of ['admin','member']){
 fs.mkdirSync(out+'/'+app+'/dist',{recursive:true});
 fs.copyFileSync(root+'/'+app+'/dist/index.html',out+'/'+app+'/dist/index.html');
 fs.cpSync(root+'/'+app+'/dist/assets',out+'/'+app+'/dist/assets',{recursive:true});
 // Static public assets are unchanged and inherited from the exact deployed image.
 fs.writeFileSync(out+'/'+app+'/Dockerfile',`FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-${app}@sha256:${digests[app]}\nCOPY dist/ /usr/share/nginx/html/\n`);
}
console.log('Prepared API overlay and web asset overlays; no public assets or environment settings replaced.');
