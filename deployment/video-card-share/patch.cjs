const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root='/site',index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8');
const entry=html.match(/type="module" crossorigin src="([^"]+)"/)[1];
let js=fs.readFileSync(path.join(root,entry),'utf8');
function replace(before,after){if(js.split(before).length!==2)throw Error('Unexpected card bundle: '+before);js=js.replace(before,()=>after)}
replace('function bT({row:e})','function bT({row:e,q:qualification})');
replace('r.jsx(bT,{row:l},l.id)','r.jsx(bT,{row:l,q:e},l.id)');
replace('r.jsx(te,{className:"text-link",to:`/content/${e.id}`,children:"探索內容 →"})','r.jsxs(te,{className:e.type==="VIDEO_EXTERNAL"?"uc-video-explore":"text-link",to:`/content/${e.id}`,children:["探索內容 ",r.jsx("span",{"aria-hidden":true,children:"→"})]}),e.type==="VIDEO_EXTERNAL"&&e.shareable&&r.jsx(ii,{q:qualification,contentId:e.id,title:e.title})');
const next='/assets/video-cards-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,16)+'.js';
fs.writeFileSync(path.join(root,next),js);fs.writeFileSync(index,html.replace(entry,next).replace('</head>','<link rel="stylesheet" href="/assets/video-cards-v1.css"></head>'));
