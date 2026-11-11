'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const [part,root]=process.argv.slice(2);
function edit(file,before,after){const p=path.join(root,file);const text=fs.readFileSync(p,'utf8');if(text.split(before).length!==2)throw Error('Unexpected base: '+file+' / '+before);fs.writeFileSync(p,text.replace(before,()=>after));}
function entry(){const index=fs.readFileSync(path.join(root,'index.html'),'utf8');return index.match(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"/)[1];}
if(part==='api'){
 edit('catalog.js'," ['guide',"," ['egfr','腎絲球過濾率計算小程式','遊戲','/health/egfr/'],\n ['guide',");
 edit('catalog.js',' const rows=basics.map', " const [published]=await db.$queryRawUnsafe('SELECT games FROM integration.health_journey_version ORDER BY version DESC LIMIT 1');\n const games=new Map(published.games.map(g=>[g.id,g]));\n const rows=basics.map");
 edit('catalog.js','body:title}));',"body:games.has(id)?games.get(id).description+' '+games.get(id).interest:title}));");
 edit('catalog.js',' const rows=(await s.resources', " const [published]=await s.db.$queryRawUnsafe('SELECT games FROM integration.health_journey_version ORDER BY version DESC LIMIT 1');\n const hidden=new Set(published.games.filter(g=>!g.enabled||g.membersOnly&&!person||g.starts&&Date.parse(g.starts)>Date.now()||g.ends&&Date.parse(g.ends)<=Date.now()).map(g=>g.id));\n const rows=(await s.resources");
 edit('catalog.js','(person,false)).filter(r=>config.config.open','(person,false)).filter(r=>!hidden.has(r.id)).filter(r=>config.config.open');
 edit('health-game.controller.js','if (!cfg.enabled)',"if (!cfg.enabled || !await require('./journeys/journeys').active(tx,'game'))");
 edit('diabetes-game.js','if (!config.open) throw',"if (!config.open || !await require('./journeys/journeys').active(tx,'diabetes')) throw");
 edit('health-game.controller.js',"    { id: 'guide',","    { id: 'egfr', title: '腎絲球過濾率計算小程式', kind: '遊戲', href: '/health/egfr/' },\n    { id: 'guide',");
 edit('health-game.controller.js',"require('./diabetes-game')(module.exports);","require('./diabetes-game')(module.exports);\nrequire('./journeys/journeys')(module.exports);");
}
if(part==='member'){
 const index=fs.readFileSync(path.join(root,'health/index.html'),'utf8');
 const hub=index.match(/src="(\.\/hub[^"]*\.js)"/)[1];edit('health/index.html','src="'+hub+'"','src="./journey/hub.js"');
 edit('health/sarcopenia.js',")),related('game'));",")),journey.explore());");
 edit('health/sarcopenia.js','answers=[];seconds=null;', "journey.start();answers=[];seconds=null;");
 edit('health/sarcopenia.js',"link('用 LINE 邀請家人','https://line.me/R/msg/text/?'+encodeURIComponent(message),'action')","journey.sharing()");
 edit('health/sarcopenia.js',"related('game'),btn('回健康護照'","journey.explore(),btn('回健康護照'");
 edit('health/sarcopenia.js',"function report(){","function report(){\n journey.finish();");
 edit('health/sarcopenia.js',"init();","import {session} from './journey/session.js';\nconst journey=await session('game');if(journey) init();");
 edit('health/diabetes/game.js','answers=[];step=0;station();','journey.start();answers=[];step=0;station();');
 edit('health/diabetes/game.js',"link('邀 LINE 好友體驗','https://line.me/R/msg/text/?'+encodeURIComponent(shareText),'action')","journey.sharing()");
 edit('health/diabetes/game.js',"link('探索血糖健康主題','/topics/?tag='+encodeURIComponent('血糖健康'))","journey.explore()");
 edit('health/diabetes/game.js','function report(){','function report(){\n  journey.finish();');
 edit('health/diabetes/game.js','\nhome();',"\nimport {session} from '../journey/session.js';\nconst journey=await session('diabetes');if(journey)home();");
 edit('health/egfr/game.js',"clearQuiz();screen('report');return true;","journey.calculated();clearQuiz();screen('report');return true;");
 edit('health/egfr/game.js',"$('claim').onclick=()=>screen('done');","$('claim').onclick=async()=>{screen('done');const saved=await journey.finish();if(journey.member){$('stamp').textContent=saved?'本週印章已收進健康護照。':'本週印章尚未儲存。';if(!saved){const retry=document.createElement('button');retry.textContent='重新領取';retry.onclick=()=>$('claim').click();$('stamp').append(retry);}}};");
 edit('health/egfr/game.js',"\nopenGame();","\nimport {session} from '../journey/session.js';\nconst journey=await session('egfr');if(journey){$('nextSteps').append(journey.sharing(),journey.explore());openGame();}");
 edit('health/egfr/index.html','<small>完成卡只顯示','<p id="stamp" role="status"></p><div id="nextSteps"></div><small>完成卡只顯示');
 for(const file of ['health/index.html','health/diabetes/index.html','health/egfr/index.html'])edit(file,'</head>','<link rel="stylesheet" href="/health/journey/theme.css"></head>');
 for(const [page,script] of [['health/diabetes/index.html','./game.js'],['health/egfr/index.html','./game.js']])edit(page,'src="'+script+'"','src="'+script+'?journey=1"');
 edit('topics/entry.js',"const host=health?document.querySelector('header')","const host=health?(document.querySelector('#journey-topics')||document.querySelector('header'))");
 edit('topics/entry.js',"path.startsWith('/health/diabetes/')?'diabetes'","path.startsWith('/health/egfr/')?'egfr':path.startsWith('/health/diabetes/')?'diabetes'");
 const file=entry(),next=file.replace('.js','-journey.js');fs.copyFileSync(path.join(root,file),path.join(root,next));
 edit(next,'i("/shop?sku="+encodeURIComponent(t))}return r.jsxs("article",{className:"product-detail"', 'window.dispatchEvent(new CustomEvent("uc-health-cart",{detail:t})),i("/shop?sku="+encodeURIComponent(t))}return r.jsxs("article",{className:"product-detail"');
 edit(next,'function UE(e,t,n,i,s){return CR(await q(', 'function UE(e,t,n,i,s){const ordered=CR(await q(');
 edit(next,'...s?{checkout:s}:{}})}),e)}async function FE(', '...s?{checkout:s}:{}})}),e);window.dispatchEvent(new CustomEvent("uc-health-order",{detail:ordered.id}));return ordered}async function FE(');
 edit(next,'throw new Error("零售訂單回應異常");return o}', 'throw new Error("零售訂單回應異常");window.dispatchEvent(new CustomEvent("uc-health-order",{detail:o.id}));return o}');
 edit(next,'onClick:()=>void m("register"),children:"報名活動"','onClick:()=>{window.dispatchEvent(new CustomEvent("uc-health-register",{detail:"event:"+e}));void m("register")},children:"報名活動"');
 edit(next,'p.current.set(j,y);try{await q(`${s}/${j}`','p.current.set(j,y);if(j==="enroll")window.dispatchEvent(new CustomEvent("uc-health-register",{detail:"course:"+e}));try{await q(`${s}/${j}`');
 edit('index.html',file,next);
 edit('index.html','</body>','<script type="module" src="/health/journey/resume.js"></script></body>');
}
if(part==='admin'){
 const file=entry();const next=file.replace('.js','-journeys.js');fs.copyFileSync(path.join(root,file),path.join(root,next));
 edit(next,'["標籤管理","/topics/","content"]','["健康中心","/health/journey/","content"],["標籤管理","/topics/","content"]');
 edit(next,'"/content/greetings","/topics/","/faq"','"/content/greetings","/health/journey/","/topics/","/faq"');
 edit(next,'"/topics/":["SUPER_ADMIN","MEMBERSHIP_OPS","ORDER_OPS"]','"/health/journey/":["SUPER_ADMIN","MEMBERSHIP_OPS","ORDER_OPS"],"/topics/":["SUPER_ADMIN","MEMBERSHIP_OPS","ORDER_OPS"]');
 edit(next,'reloadDocument:m==="/topics/"','reloadDocument:m==="/topics/"||m==="/health/journey/"');
 edit('index.html',file,next);
 edit('health/index.html','<strong>健康中心管理</strong>','<strong>健康中心管理</strong><a href="./journey/">遊戲上架與成效</a>');
 edit('topics/topics.js',"search='',itemId=''","search=new URL(location.href).searchParams.get('q')||'',itemId=new URL(location.href).searchParams.get('item')||''");
}
