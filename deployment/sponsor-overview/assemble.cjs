const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const root = path.resolve(process.argv[2]);
const assets = path.join(root,'assets');
const previous = 'admin-ops-2d1a5b201e2bce03.js';
const base = fs.readFileSync(path.join(assets,previous),'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
if (hash(base)!=='3ea66ed08e4501c2f8f67b64c330b8c08f44119a71b2a8811a753682adc2fbc3') {
  throw Error('The installed admin shell differs from the verified release');
}
function once(source,anchor,replacement) {
  if (source.split(anchor).length!==2) throw Error('Unexpected admin asset: '+anchor);
  return source.replace(anchor,()=>replacement);
}
const component = fs.readFileSync(path.join(__dirname,'component.js'),'utf8');
const style = fs.readFileSync(path.join(__dirname,'sponsor-overview.css'),'utf8');
const entry = 'function Jy({initialMode:';
let main = once(base,entry,component+'\n'+entry);
main = once(main,'"/organization": "推薦人 推薦組織 上下線"','"/organization": "推薦人 推薦組織 上下線 組織樹 推薦樹全貌圖"');
main = once(main,'h==="BINARY"&&e.jsx(nN,{})','h==="BINARY"?e.jsx(nN,{}):e.jsx(SponsorOverview,{selectedRootId:o?.id,selection:o,renderBall360:id=>e.jsx(hm,{id},id)})');

// The lazy pages import React and the router from the shell. Version both ends
// of these imports together so reopening another admin page uses one runtime.
const chunks = [...new Set([...base.matchAll(/import\("\.\/([^"]+\.js)"\)/g)].map(match=>match[1]))];
if (!chunks.length) throw Error('Admin lazy modules missing');
const files = chunks.map(name=>({name,code:fs.readFileSync(path.join(assets,name),'utf8')}));
const version = hash(main+style+files.map(f=>f.code).join('')).slice(0,16);
const newMain = 'sponsor-overview-'+version+'.js';
for (const {name,code} of files) {
  const newName = name.replace(/\.js$/,'-sponsor-'+version+'.js');
  const updated = once(code,'from"./'+previous+'"','from"./'+newMain+'"');
  fs.writeFileSync(path.join(assets,newName),updated);
  main = main.replaceAll('"./'+name+'"','"./'+newName+'"');
  const vitePreloadName=name.replace(/-ops-[a-f0-9]{16}\.js$/,'.js');
  main = main.replaceAll('"assets/'+vitePreloadName+'"','"assets/'+newName+'"');
}
fs.writeFileSync(path.join(assets,newMain),main);
const newStyle = 'sponsor-overview-'+hash(style).slice(0,16)+'.css';
fs.writeFileSync(path.join(assets,newStyle),style);
function updateEntryPoints(directory) {
  for (const file of fs.readdirSync(directory,{withFileTypes:true})) {
    const target=path.join(directory,file.name);
    if (file.isDirectory()) { updateEntryPoints(target); continue; }
    if (!file.name.endsWith('.html')) continue;
    const html=fs.readFileSync(target,'utf8');
    if (!html.includes('/assets/'+previous)) continue;
    fs.writeFileSync(target,once(html.replaceAll('/assets/'+previous,'/assets/'+newMain),'</head>','<link rel="stylesheet" href="/assets/'+newStyle+'"></head>'));
  }
}
updateEntryPoints(root);
if (!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('/assets/'+newMain)) throw Error('Admin entry is missing');
console.log('Installed recommendation map',newMain);
