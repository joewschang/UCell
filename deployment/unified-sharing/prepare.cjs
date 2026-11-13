const fs=require('fs'),p=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=p.resolve(__dirname,'../..'),out=p.resolve(process.argv[4]);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),read=f=>fs.readFileSync(f,'utf8'),write=(f,s)=>{fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,s)};
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,()=>b)};
const span=(s,a,b,v)=>{let i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,a);return s.slice(0,i)+v+s.slice(j)};
const icons=read(root+'/member/src/GreetingShareIcon.tsx').split('const paths = ')[1].split(';')[0];
const memberBase=p.resolve(process.argv[2]),adminBase=p.resolve(process.argv[3]);
const paths=['/health/?game=sarcopenia','/health/diabetes/','/health/egfr/','/health/blood-pressure/','/health/cognition/','/browse/packages'];
const map=JSON.stringify(paths);
function member(code){
 const component=`function LA({q:e,contentId:t,productSku:n,eventCode:i,courseCode:s,title:o="一起探索 UCell",packageList=false}){
 const [message,set]=h.useState(''),[busy,mark]=h.useState(false),lock=h.useRef(false);
 async function send(platform){if(lock.current)return;lock.current=true;mark(true);set('');
 try{const link=await xR(e,t,{productSku:n,eventCode:i,courseCode:s}),u=new URL(link.shareUrl);if(packageList)u.searchParams.set('to','5');const url=encodeURIComponent(u.href),text=encodeURIComponent(o+' '+u.href);
 if(platform==='instagram'){try{await navigator.clipboard.writeText(u.href);set('已複製連結，可貼至 Instagram。')}catch{set(u.href)}}else location.assign(({line:'https://line.me/R/share?text='+text,facebook:'https://www.facebook.com/sharer/sharer.php?u='+url,threads:'https://www.threads.net/intent/post?text='+text,x:'https://twitter.com/intent/tweet?text='+text})[platform]);}
 catch{set('無法建立推薦連結，請再試一次。')}finally{lock.current=false;mark(false)}}
 const paths=${icons};return r.jsxs('div',{className:'uc-share-actions',children:[r.jsx('button',{className:'uc-share-line',disabled:busy,onClick:()=>send('line'),children:'分享LINE好友'}),r.jsx('div',{className:'uc-share-social',children:Object.keys(paths).map(key=>r.jsx('button',{'aria-label':'分享至 '+key,disabled:busy,onClick:()=>send(key),children:r.jsx('svg',{viewBox:'0 0 24 24',width:24,height:24,fill:'currentColor','aria-hidden':true,children:r.jsx('path',{d:paths[key]})})},key))}),message&&r.jsx('p',{role:'status',children:message})]})}
 function wo({q,sku,title}){return r.jsx(LA,{q,productSku:sku,title,packageList:!sku})}`;
 code=span(code,'function LA({','function n0(e)',component);
 code=once(code,'x=wd(n==null?void 0:n.destination)','x=(e&&n&&n.destination==="/"&&/^[0-5]$/.test(new URLSearchParams(location.search).get("to")??"")?'+map+'[Number(new URLSearchParams(location.search).get("to"))]:wd(n==null?void 0:n.destination))');
 code=once(code,'href:x,children:((w=', 'href:x,children:x.startsWith("/health/")?"開始體驗健康遊戲":x==="/browse/packages"?"查看套組":((w=');
 code=once(code,'})]})]}),i.shareable&&r.jsx(ii,{q:e,contentId:t','})]}),i.shareable&&r.jsx(ii,{q:e,contentId:t');
 code=once(code,'??"network"}:${t}`),!i.shareable','??"network"}:${t}`)]}),!i.shareable');
 return code;
}
function admin(code){
 const before='e.jsx("strong",{children:O.title}),e.jsx(JE,{src:O.thumbnailUrl';
 const edit='t&&e.jsx("button",{type:"button",children:"編輯此版本資料",onClick:()=>{j(q.id);y({...Rl,contentType:q.type,title:O.title,summary:O.summary??"",externalUrl:O.url,thumbnailUrl:O.thumbnailUrl??"",audiencePolicy:O.audiencePolicy,shareable:O.shareable,publishFrom:tL(O.publishFrom),publishTo:tL(O.publishTo)});document.querySelector("#content-editor input")?.focus()}})';
 code=once(code,before,'e.jsx("strong",{children:O.title}),'+edit+',e.jsx(JE,{src:O.thumbnailUrl');
 return once(code,'title:"建立內容或新版本",children:e.jsxs("fieldset",{className:"form"','title:"建立內容或新版本",children:e.jsxs("fieldset",{id:"content-editor",className:"form"');
}
for(const [app,base,transform,digest] of [['admin',adminBase,admin,'a733c8b03c766f110d43aa2f08577e6dfa5771cf65642327d2f8bcb2bd5e7599'],['member',memberBase,member,'4197c34eb0f57c9d9064518940f26f4d8439f0d081da943238b1a1e996b908d2']]){
 const dir=p.join(out,app),html=read(base+'/index.html'),entry=html.match(/type="module" crossorigin src="\/assets\/([^"]+)"/)[1];
 require(root+'/deployment/third-placement/site/prepare.cjs').prepare(app,base,dir,{image:digest,entry,html:hash(html),entryHash:hash(read(base+'/assets/'+entry)),edits:[],transform},'social-share');
 if(app==='admin')continue;
 const dest=dir+'/overlay/',health=root+'/deployment/health-journeys/';
 for(const f of ['hub.js','share-controls.js','session.js','theme.css']){
 let src=read(health+(f==='theme.css'?'':'member/')+f);
 if(f==='session.js')src=once(src,'JSON.stringify({qualificationId,healthGame:game.id})','JSON.stringify({qualificationId})').replace('return data.shareUrl;','const u=new URL(data.shareUrl);const choice='+map+'.indexOf(game.href);if(choice<0)throw Error("未知的遊戲");u.searchParams.set("to",String(choice));return u.href;');
 write(dest+'health/journey/'+f,src);
 }
 const old='entry-liff-d28859ebc9969a2a.js',g=read(base+'/greetings/'+old);
 let gs=once(g,'function X1({greeting:e,refresh:t}){','function X1({greeting:e,refresh:t}){const [file,setFile]=le.useState();le.useEffect(()=>{const ctl=new AbortController();fetch(e.imageUrl,{credentials:"omit",signal:ctl.signal}).then(async res=>{if(res.ok){const blob=await res.blob();if(!ctl.signal.aborted&&blob.type==="image/png")setFile(new File([blob],"UCell-"+e.date+".png",{type:"image/png"}))}}).catch(()=>{});return()=>ctl.abort()},[e.imageUrl,e.date]);');
 gs=span(gs,'function N(O){if(!E||!T()','async function q()',`async function N(platform){if(!T())return;y.current=true;o("share");s("");a("");try{if(platform==="LINE"&&Xh())await gs.shareTargetPicker([{type:"image",originalContentUrl:e.imageUrl,previewImageUrl:e.imageUrl}]);else if(file&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file]});else a("請先儲存圖片，再從 "+platform+" 選取圖片分享。")}catch(err){if(err.name!=="AbortError")s("圖片分享未完成，可儲存後再分享。")}finally{_()}}`);
 gs=span(gs,'x.jsx("a",{className:"uc-daily-line"','n==="ready"&&x.jsxs("p",{className:"uc-daily-note",children:[x.jsx("a",{href:e.imageUrl',`x.jsx("button",{className:"uc-share-line",disabled:!m,onClick:()=>N("LINE"),children:"分享LINE好友"}),x.jsx("button",{disabled:!m,onClick:q,children:"儲存圖片"})]}),x.jsx("div",{className:"uc-daily-actions uc-social-logos",children:["facebook","threads","x","instagram"].map(key=>x.jsx("button",{disabled:!m,"aria-label":"分享圖片至 "+key,onClick:()=>N(key),children:x.jsx(Yd,{platform:key})},key))}),`);
 const newG='entry-image-'+hash(gs).slice(0,16)+'.js';write(dest+'greetings/'+newG,gs);
 write(dest+'assets/share-platforms-v2.css',read(root+'/member/public/assets/share-platforms-v2.css'));
 write(dest+'assets/share-actions-v1.css',read(root+'/member/src/social-share.css'));
 const mf=dir+'/manifest.json',man=JSON.parse(read(mf));man.replacements[old]=newG;man.replacements['</head>']='<link rel="stylesheet" href="/assets/share-actions-v1.css"></head>';write(mf,JSON.stringify(man));
}
