// Run after changing the shared product content to keep all three static sites identical.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=path.join(root,'member/public/products');
const catalog=JSON.parse(fs.readFileSync(path.join(source,'catalog-20261029.json')));
const files=['catalog-20261029.json','catalog-20261029.js','catalog-20261029.css',...catalog.products.map(p=>path.basename(p.poster))];
for(const folder of ['admin/public/products','website/products']){const target=path.join(root,folder);fs.mkdirSync(target,{recursive:true});for(const file of files)fs.copyFileSync(path.join(source,file),path.join(target,file));}
const hook='<link rel="stylesheet" href="/products/catalog-20261029.css"><script defer src="/products/catalog-20261029.js"></script>';
for(const file of ['member/index.html','admin/index.html','website/index.html','website/products.html',...catalog.products.map(p=>'website/product-'+p.sku.slice(4)+'.html')]){const full=path.join(root,file);let html=fs.readFileSync(full,'utf8');if(!html.includes('catalog-20261029.js'))html=html.replace('</head>',hook+'</head>');fs.writeFileSync(full,html);}
const docker=path.join(root,'deployment/Dockerfile.website');let text=fs.readFileSync(docker,'utf8');if(!text.includes('COPY website/products '))fs.writeFileSync(docker,text.replace('EXPOSE 80','COPY website/products /usr/share/nginx/html/products\nEXPOSE 80'));
console.log('Shared product catalog synchronized across member, admin and website.');
