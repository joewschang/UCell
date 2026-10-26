const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../../..'),dest='D:/UCell/review-work/network-faq-release';
const registry='ucellprodacrm3z2zx4ohqyui.azurecr.io/';
const bases={api:'ff5b0fa03262767c86c7aa32ac2c2b21265618548a6baea8bd31bd5876a4e149',admin:'b730a6e286e74bfb74bd083b3008c6c46e2839e8102e3eab2680b4793155c6ca',member:'0789ac2788dfd19727929d2bbd974522f5d18482b252e0a96ea2fe455d562499',website:'06988c5b27de55c0576c7a25a84fec873348d83f6db864b9c5a0d18d44757c71'};
function copy(a,b){fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b)}
const api=dest+'/api';fs.mkdirSync(api,{recursive:true});
for(const f of ['auth/network-profile','auth/network-registration.controller','auth/network-registration.service','auth/member-web-registration.controller','auth/member-web-registration.service','auth/contact-verification.service','public-website/faq.controller','public-website/public-website.module'])copy(root+'/backend/apps/api/dist/modules/'+f+'.js',api+'/modules/'+f+'.js');
copy(root+'/backend/packages/database/prisma/migrations/20261026150000_faq_management/migration.sql',api+'/faq-migration.sql');
let migrate=fs.readFileSync(root+'/deployment/releases/event-delete-20261023/migrate.cjs','utf8').replaceAll('20261023150000_event_delete','20261026150000_faq_management').replaceAll('event-delete-migration.sql','faq-migration.sql');
fs.writeFileSync(api+'/faq-migrate.cjs',migrate);copy(__dirname+'/verify-rollback.cjs',api+'/faq-verify.cjs');
fs.writeFileSync(api+'/Dockerfile',`FROM ${registry}ucell-api@sha256:${bases.api}\nCOPY modules/ /app/apps/api/dist/modules/\nCOPY *.cjs *.sql /app/apps/api/dist/\nCMD ["sh","-c","node /app/apps/api/dist/faq-migrate.cjs && exec node /app/apps/api/dist/main.js"]\n`);
for(const app of ['member','admin']){const dir=dest+'/'+app;fs.mkdirSync(dir,{recursive:true});fs.cpSync(root+'/'+app+'/dist',dir+'/dist',{recursive:true});fs.writeFileSync(dir+'/Dockerfile',`FROM ${registry}ucell-${app}@sha256:${bases[app]}\nCOPY dist/ /usr/share/nginx/html/\n`);}
const web=dest+'/website';copy(root+'/website/faq.html',web+'/faq.html');copy(root+'/website/assets/js/faq-live.js',web+'/faq-live.js');fs.writeFileSync(web+'/Dockerfile',`FROM ${registry}ucell-website@sha256:${bases.website}\nCOPY faq.html /usr/share/nginx/html/faq.html\nCOPY faq-live.js /usr/share/nginx/html/assets/js/faq-live.js\n`);
console.log(dest);

copy(root+'/website/deploy/faq-location.conf',web+'/faq-location.conf');
fs.appendFileSync(web+'/Dockerfile', `COPY faq-location.conf /etc/nginx/faq-location.conf\nRUN sed -i '/server_name _;/a\\ include /etc/nginx/faq-location.conf;' /etc/nginx/conf.d/default.conf && nginx -t\n`);
