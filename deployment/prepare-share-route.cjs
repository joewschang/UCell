const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),base='C:/UCell/share-route-20261023',release=path.join(__dirname,'releases/share-route-20261023');
const source=fs.readFileSync(base+'/main.js','utf8'),needle='new platform_fastify_1.FastifyAdapter({ logger: true })';
if(source.split(needle).length!==2)throw Error('Production bootstrap mismatch');
const patched=source.replace(needle,'new platform_fastify_1.FastifyAdapter(require("./http-options").HTTP_OPTIONS)');
for(const target of [base+'/api',release]){fs.mkdirSync(target+'/overlay',{recursive:true});fs.writeFileSync(target+'/overlay/main.js',patched);fs.copyFileSync(root+'/backend/apps/api/dist/http-options.js',target+'/overlay/http-options.js');fs.writeFileSync(target+'/Dockerfile','FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:04e91a4ca37b83d880e9903d34a3c83ce12f9cc2146a3c3bcb5ed71b0c9ed980\nCOPY overlay/ /app/apps/api/dist/\n');}
console.log('Only router options changed; deployed KYC transport and other bootstrap behavior preserved.');
