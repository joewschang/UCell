const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const [part,dir,base]=process.argv.slice(2);
const root=path.join(dir,part);
async function main(){
 const dist=path.join(root,'dist');
 fs.mkdirSync(path.join(dist,'assets'),{recursive:true});
 fs.cpSync(path.join(part,'public/health'),path.join(dist,'health'),{recursive:true});
 const host='https://'+part+'.ucell.life';
 const html=await(await fetch(host+'/')).text();
 const asset=html.match(/src="(\/assets\/index-[\w-]+\.js)"/)[1];
 const code=await(await fetch(host+asset)).text();
 const isMember=part==='member';
 const oldCard='r.jsxs("a",{className:"card uc-hub-card",href:"/health/",children:[r.jsx("h2",{children:"健康中心"}),r.jsx("p",{children:"本週任務 · 居家腿力與骨骼自我觀察 →"})]}),';
 const before=isMember?'r.jsx(oh,{items:qA})':'e.jsx(jt,{title:"影音／連結內容"';
 const heart=fs.readFileSync('shared/design-system/icons.tsx','utf8').match(/health:\[\{d:'([^']+)'/)[1];
 const icon='r.jsx("svg",{className:"uc-icon",width:20,height:20,viewBox:"0 0 24 24",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round",fill:"none","aria-hidden":true,children:r.jsx("path",{d:'+JSON.stringify(heart)+'})})';
 const card='r.jsxs("a",{className:"card uc-hub-card",href:"/health/",children:['+icon+',r.jsxs("div",{children:[r.jsx("h2",{children:"健康中心"}),r.jsx("p",{children:"本週任務 · 居家腿力與骨骼自我觀察"})]}),r.jsx("span",{"aria-hidden":true,children:"→"})]}),';
 const after=isMember?card+before:'e.jsx("a",{className:"button",href:"/health/",children:"健康中心管理 · 任務與標籤"}),'+before;
 const original=isMember?code.replace(oldCard,''):code;
 if(original.split(before).length!==2 || original.includes(after))throw Error('Unexpected production entry '+part);
 const next=original.replace(before,after),name='index-health-'+crypto.createHash('sha256').update(next).digest('hex').slice(0,12)+'.js';
 fs.writeFileSync(path.join(dist,'assets',name),next);
 fs.writeFileSync(path.join(dist,'index.html'),html.replace(asset,'/assets/'+name).replace('</body>',(isMember&&!html.includes('/health/related-entry.js')?'<script type="module" src="/health/related-entry.js"></script>':'')+'</body>'));
 fs.writeFileSync(path.join(root,'Dockerfile'),'FROM '+base+'\nCOPY dist/ /usr/share/nginx/html/\n');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
