const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out='C:/UCell/pnasl-20261023',release=root+'/deployment/releases/pnasl-20261023';
for(const base of [out+'/api',release]){
 const dir=base+'/overlay/modules/analytics';fs.mkdirSync(dir,{recursive:true});
 for(const name of ['analytics.policy.js','analytics.source.js','analytics.service.js','analytics.history.js','analytics.prospects.js'])fs.copyFileSync(root+'/backend/apps/api/dist/modules/analytics/'+name,dir+'/'+name);
 fs.writeFileSync(base+'/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:8f01bcc5fb467b294a4fe79445d2f7969c72c0d43cf1b4821bc638d968c1250c\nCOPY overlay/ /app/apps/api/dist/\n');
}
fs.mkdirSync(out+'/admin/dist',{recursive:true});fs.copyFileSync(root+'/admin/dist/index.html',out+'/admin/dist/index.html');fs.cpSync(root+'/admin/dist/assets',out+'/admin/dist/assets',{recursive:true});
fs.writeFileSync(out+'/admin/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-admin@sha256:b0fa937e750b1c9fe125221e97faef4f452baa6dec91f93ee54f165e31d407c3\nCOPY dist/ /usr/share/nginx/html/\n');
console.log('PNASL overlays prepared; existing production fixes and static public assets preserved.');
