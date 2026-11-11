const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(process.argv[2]);
const directory = path.join(root,'assets');
const htmlFile = path.join(root,'index.html');
const html = fs.readFileSync(htmlFile,'utf8');
const old = html.match(/<script type="module"[^>]+src="\/assets\/([^"]+\.js)"/)?.[1];
if(old !== 'award-audit-727078903ec6.js') throw Error('Unexpected base main asset: '+old);
const read = name=>fs.readFileSync(path.join(__dirname,name),'utf8');
function once(s,old,value) {
  if(s.split(old).length!==2) throw Error('Release anchor not unique: '+old.slice(0,95));
  return s.replace(old,()=>value);
}
const scratch = path.join(directory,'.admin-ops-build.js');
fs.copyFileSync(path.join(directory,old),scratch);
for(const patch of ['navigation/patch.cjs','workbench/patch.cjs','control/patch-payment.cjs','report/patch.cjs']) {
  execFileSync(process.execPath,[path.join(__dirname,patch),scratch],{stdio:'inherit'});
}
let js=fs.readFileSync(scratch,'utf8');
fs.unlinkSync(scratch);
const start=js.indexOf('function Jl({rows:r,columns:t,');
const end=js.indexOf('var dc=r=>r.type==="checkbox"',start);
if(start<0 || end<start || end-start>4500 || !js.slice(start,end).includes('aria-sort')) throw Error('Unexpected data grid');
js=js.slice(0,start)+read('grid/component.js')+'\n'+js.slice(end);
const roles='"/applications/new":["SUPER_ADMIN","MEMBERSHIP_OPS"]';
js=once(js,roles,roles+',"/applications/formal-paper":["SUPER_ADMIN","MEMBERSHIP_OPS"]');
js=once(js,'actions:e.jsxs("div",{className:"button-row",children:[e.jsx(It,{className:"button-link",to:"/applications/new"',
  'actions:Ea(r?.role,"/applications/formal-paper")&&e.jsxs("div",{className:"button-row",children:[e.jsx(It,{className:"button-link",to:"/applications/new"');

// Keep lazy modules in the same React, router and query-client instance as the shell.
// Derive a single release version from both sides of the otherwise circular module graph.
const chunks = [...new Set([...js.matchAll(/import\("\.\/([^"]+\.js)"\)/g)].map(match=>match[1]))];
const originalImport='from"./index-BFocjydV.js"';
const files=chunks.map(filename=>({filename,code:fs.readFileSync(path.join(directory,filename),'utf8')}));
const styles=['grid/grid.css','report/report.css','workbench/workbench.css','control/control.css','navigation/navigation.css','navigation/contrast.css'];
const css=styles.map(read).join('\n');
const stamp=crypto.createHash('sha256').update(js+css+files.map(f=>f.code).join('')).digest('hex').slice(0,16);
const main='admin-ops-'+stamp+'.js';
for(const {filename,code} of files){
  const name=filename.replace(/\.js$/,'-ops-'+stamp+'.js');
  const updated=once(code,originalImport,'from"./'+main+'"');
  if(!js.includes('"./'+filename+'"'))throw Error('Unreferenced chunk '+filename);
  js=js.replaceAll('"./'+filename+'"','"./'+name+'"');
  fs.writeFileSync(path.join(directory,name),updated);
}
fs.writeFileSync(path.join(directory,main),js);
const stylesheet='admin-ops-'+stamp+'.css';
fs.writeFileSync(path.join(directory,stylesheet),css);
function updateHtml(dir){
  for(const file of fs.readdirSync(dir,{withFileTypes:true})){
    const dest=path.join(dir,file.name);
    if(file.isDirectory()){updateHtml(dest);continue;}
    if(!file.name.endsWith('.html'))continue;
    const content=fs.readFileSync(dest,'utf8');
    if(content.includes('/assets/'+old)){
      const after=content.replaceAll('/assets/'+old,'/assets/'+main);
      fs.writeFileSync(dest,once(after,'</head>','<link rel="stylesheet" href="/assets/'+stylesheet+'"></head>'));
    }
  }
}
updateHtml(root);
console.log('Admin release:',main,stylesheet,'shared runtime chunks:',chunks.length);
