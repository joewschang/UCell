'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const [site, payload]=process.argv.slice(2);
const {previous,entry,sheet,inputs}=JSON.parse(fs.readFileSync(path.join(payload,'manifest.json'),'utf8'));
for(const [name,sha] of Object.entries(inputs)){
  const bytes=fs.readFileSync(path.join(site,'assets',name));
  if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Base image mismatch for '+name);
}
fs.cpSync(path.join(payload,'assets'),path.join(site,'assets'),{recursive:true});
function install(dir){
  for(const file of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,file.name);
    if(file.isDirectory()){install(p);continue;}
    if(!file.name.endsWith('.html'))continue;
    const html=fs.readFileSync(p,'utf8');
    if(!html.includes('/assets/'+previous))continue;
    if(!html.includes('</head>'))throw Error('Cannot install stylesheet in '+p);
    fs.writeFileSync(p,html.replaceAll('/assets/'+previous,'/assets/'+entry)
      .replace('</head>','<link rel="stylesheet" href="/assets/'+sheet+'"></head>'));
  }
}
install(site);
if(!fs.readFileSync(path.join(site,'index.html'),'utf8').includes('/assets/'+entry))throw Error('Missing admin shell');
