const fs=require('node:fs'),p=require('node:path'),assert=require('node:assert/strict');
const root=process.argv[2],side=process.argv[3],home=__dirname;
function one(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,()=>b)}
function edit(file,fn){const path=p.join(root,file);fs.writeFileSync(path,fn(fs.readFileSync(path,'utf8')))}
const runtime=fs.readFileSync(home+'/runtime.js','utf8');
if(side==='member'){
 edit('seasons/v1/entry.js',s=>{
 s=one(s,"customElements.define('uc-season-picker',Picker);auth();setInterval(auth,1300);addEventListener('pageshow',auth);document.addEventListener('visibilitychange',()=>{if(!document.hidden)auth()});",`function renderSeason(){
 theme=window.ucThemeCalendar.theme;root.dataset.season=theme;
 document.querySelectorAll('uc-season-picker').forEach(node=>{const p=document.createElement('p');p.textContent='目前主題：'+names[theme][0]+'（依節慶排程）';node.replaceChildren(p)});
 }
 let synced='',inFlight=false;
 async function syncMenu(){
  const account=session('ucell_member_token'),wanted=window.ucThemeCalendar.theme;
  if(!window.ucThemeCalendar.confirmed||inFlight||!account||synced===account+'|'+wanted||!document.documentElement.hasAttribute('data-season'))return;
  inFlight=true;try{
   const headers={Authorization:'Bearer '+account},res=await fetch(endpoint,{headers,signal:AbortSignal.timeout(10000)});
   if(!res.ok)return;const envelope=await res.json(),current=envelope.data||envelope;
   if(current.theme!==wanted||current.needsSync){
    const saved=await fetch(endpoint,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({theme:wanted}),signal:AbortSignal.timeout(45000)});
    if(!saved.ok)return;const result=await saved.json();if((result.data||result).needsSync)return;
   }
   synced=account+'|'+wanted;
  }catch{}finally{inFlight=false}
 }
 window.addEventListener('ucell:theme-calendar',syncMenu);setInterval(syncMenu,60000);
 class ScheduledPicker extends HTMLElement{connectedCallback(){renderSeason()}}
 customElements.define('uc-season-picker',ScheduledPicker);window.addEventListener('ucell:theme-calendar',renderSeason);renderSeason();`);
 return runtime+'\n'+s;
 });
 edit('welcome-sound/welcome.js',s=>{
 s=one(s,'player??=new Audio(clip);',"player??=new Audio(window.ucThemeCalendar?.audio('member')||clip);");
 s=one(s,'}else attempt(true);',"}else Promise.resolve(window.ucThemeCalendar?.ready()).then(()=>attempt(true));");
 return one(s,'preview??=new Audio(clip);',"preview?.pause();preview=new Audio(window.ucThemeCalendar?.audio('member')||clip);");
 });
}else{
 const html=fs.readFileSync(root+'/index.html','utf8'),entry=html.match(/type="module" crossorigin src="\/assets\/([^"]+.js)"/)[1];
 const code=fs.readFileSync(root+'/assets/'+entry,'utf8');
 const transform=s=>{
 s=one(s,'let e=new Audio(w),','let e=new Audio(),');
 s=one(s,'document.hidden||c()}return h(k);','Promise.resolve(window.ucThemeCalendar.ready()).then(()=>{if(u===o){e.src=window.ucThemeCalendar.audio("admin");if(!document.hidden)c()}})}return h(k);');
 s=one(s,'e.jsx(jt,{title:"影音／連結內容"', 't&&e.jsx("uc-theme-manager",{}),e.jsx(jt,{title:"影音／連結內容"');
 return runtime+'\n'+fs.readFileSync(home+'/manager.js','utf8')+'\n'+s;
 };
 const name='admin-theme-calendar-261113.js',chunks=[...new Set([...code.matchAll(/["']\.\/(\w[^"'\s/]*\.js)["']/g)].map(m=>m[1]))],rename=s=>chunks.reduce((a,b)=>a.replaceAll(b,b.replace('.js','-theme261113.js')),s).replaceAll(entry,name);
 for(const f of chunks)fs.writeFileSync(root+'/assets/'+rename(f),rename(fs.readFileSync(root+'/assets/'+f,'utf8')));
 fs.writeFileSync(root+'/assets/'+name,rename(transform(code)));
 edit('index.html',s=>one(s,entry,name).replace('</head>','<link rel="stylesheet" href="/seasons/admin-calendar.css"></head>'));
}
