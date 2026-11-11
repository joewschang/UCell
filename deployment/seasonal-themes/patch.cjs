const fs=require('fs'),path=require('path'),crypto=require('crypto'),dir=process.argv[2],idx=path.join(dir,'index.html');
let html=fs.readFileSync(idx,'utf8'),asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1],js=fs.readFileSync(path.join(dir,asset),'utf8');
const anchor='r.jsx("h3",{children:"顯示設定"}),r.jsx(kj,{})';if(js.split(anchor).length!==2)throw Error('Unexpected preference control');
js=js.replace(anchor,anchor+',r.jsx("uc-season-picker",{})');
const newAsset='/assets/season-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,14)+'.js';fs.writeFileSync(path.join(dir,newAsset),js);
fs.writeFileSync(idx,html.replace(asset,newAsset));
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const file=path.join(d,e.name);if(e.isDirectory())walk(file);else if(file.endsWith('.html')){let s=fs.readFileSync(file,'utf8');if(!s.includes('</head>'))throw Error('No head: '+file);fs.writeFileSync(file,s.replace('</head>','<link rel="stylesheet" href="/seasons/v1/season.css"><script src="/seasons/v1/entry.js" defer></script></head>'))}}}walk(dir);
