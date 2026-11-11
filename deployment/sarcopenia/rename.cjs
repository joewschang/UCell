const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const [kind,root]=process.argv.slice(2);
const old='居家腿力與骨骼自我觀察',title='肌少症自我檢測';
const index=path.join(root,'index.html');
const html=kind==='member'?fs.readFileSync(index,'utf8'):'';
const file=kind==='member'?path.join(root,html.match(/src="(\/assets\/[^"]+\.js)"/)[1]):root;
const text=fs.readFileSync(file,'utf8');if(!text.includes(old))throw Error('Unknown health game metadata');
const updated=text.replaceAll(old,title);
if(kind==='member'){
 const asset='/assets/member-health-'+crypto.createHash('sha256').update(updated).digest('hex').slice(0,12)+'.js';
 fs.writeFileSync(path.join(root,asset),updated);fs.writeFileSync(index,html.replace(/src="\/assets\/[^"]+\.js"/,'src="'+asset+'"'));
}else fs.writeFileSync(file,updated);
