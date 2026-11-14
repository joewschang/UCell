const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=process.argv[2];
const index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8'),entry=html.match(/type="module" crossorigin src="([^"]+)"/)[1];
const source=fs.readFileSync(path.join(root,entry),'utf8');
if(!source.includes('children:"增加"')||!source.includes('children:"減少"'))throw Error('Unexpected member quantity controls');
const bundle=source.replace(/children:"(?:減少|−|\\u2212)"/g,'children:"-"').replace(/children:"(?:增加|＋|\\uFF0B)"/g,'children:"+"');
const next='/assets/member-qty-'+crypto.createHash('sha256').update(bundle).digest('hex').slice(0,14)+'.js';
fs.writeFileSync(path.join(root,next),bundle);
fs.writeFileSync(index,html.replace(entry,next).replace('</head>','<link rel="stylesheet" href="/assets/member-quantity-v1.css"></head>'));
