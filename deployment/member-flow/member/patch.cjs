const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],asset='/assets/member-flow-v1';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
let html=read('index.html'),entry=html.match(/src="(\/assets\/member-line-entry-[^"]+\.js)"/)[1],s=read(entry);
function change(from,to){if(s.split(from).length!==2)throw Error('Unexpected occurrence: '+from);s=s.replace(from,()=>to);}
change('async function E(){var y,m;if(!o||u)return;const j=e;', 'async function E(proof){var y,m;const o=proof;if(!o||u)return;const j=e;');
change('onVerified:a,disabled:t||u}),o&&r.jsx(A,','onVerified:proof=>{a(proof);if(proof)void E(proof)},disabled:t||u}),u&&r.jsx("p",{role:"status",children:"正在儲存手機驗證…"}),o&&f&&r.jsx(A,');
change('onClick:E,children:u?"儲存中…":"儲存手機驗證並繼續"','onClick:()=>E(o),children:"重試儲存手機驗證"');
change('請先完成手機簡訊驗證，並按「儲存手機驗證並繼續」。','請先完成手機簡訊驗證，並等候驗證結果儲存。');
change('children:d.pendingBallNo??"球號待確認"','children:[d.pendingBallNo??"球號待確認"," · ",d.pendingMemberName||"姓名未提供"]');
change('${d.sponsorBallNo} ${d.pendingMemberNo}','${d.sponsorBallNo} ${d.pendingMemberNo} ${d.pendingMemberName??""}');
change('篩選球號／會員編號','篩選球號、會員編號或姓名');
change('["安置 ",e.pendingBallNo]','["安置 ",e.pendingBallNo," · ",e.pendingMemberName||"姓名未提供"]');
change('children:e.pendingBallNo}','children:[e.pendingBallNo," · ",e.pendingMemberName||"姓名未提供"]}');
change('[c.parent," · ",c.side','[c.parent," · ",v?.nodes.find(node=>node.ballNo===c.parent)?.memberName||"姓名未提供"," · ",c.side');
change('[s,o]=h.useState("ALL");if(t.error)return r.jsx(be,{message:t.error,retry:t.retry});if(!t.data)return r.jsx(Ie,{});const a=t.data.filter(l=>(s==="ALL"||l.type===s)', '[s,o]=h.useState("ALL"),[topic,setTopic]=h.useState("");if(t.error)return r.jsx(be,{message:t.error,retry:t.retry});if(!t.data)return r.jsx(Ie,{});const a=t.data.filter(l=>(!topic||contentTopic(l)===topic)&&(s==="ALL"||l.type===s)');
change('r.jsx("div",{className:"uc-content-actions","aria-label":"內容分類"', 'r.jsxs("label",{children:["內容主題",r.jsx("select",{value:topic,onChange:event=>setTopic(event.target.value),children:[r.jsx("option",{value:"",children:"全部主題"},"all"),...orderedTags([...new Set(t.data.map(contentTopic))]).map(name=>r.jsx("option",{value:name,children:name},name))]})]}),r.jsx("div",{className:"uc-content-actions","aria-label":"內容分類"');
change('[e.type==="VIDEO_EXTERNAL"?"影音":"閱讀素材"," · ",e.audiencePolicy','[contentTopic(e)," · ",e.type==="VIDEO_EXTERNAL"?"影音":"閱讀素材"," · ",e.audiencePolicy');
change('[y,m]=h.useState(null),v=h.useRef(0);','[y,m]=h.useState(null),original=h.useRef(null),v=h.useRef(0);');
change('b(()=>WE(I),"正在準備照片…")',`b(async()=>{
 let source=await WE(I), points;
 try{
   points=await detect(source);
   const bitmap=await createImageBitmap(source);
   const ratio=(points[2].x-points[0].x)*bitmap.width/((points[2].y-points[0].y)*bitmap.height);
   bitmap.close();
   if((t.startsWith("IDENTITY_")&&ratio<.8)||await sidewaysText(source,points)){source=await jm(source,[],true);points=await detect(source);}
 }catch{points=rect();}
 original.current={source,points};
 return points[0].x===0&&points[0].y===0&&points[2].x===1&&points[2].y===1?source:await jm(source,points);
},"正在判斷文件方向與邊界…")`);
const start=s.indexOf(',onClick:I=>{if(!y||y.length>=4||C)return;'),end=s.indexOf(']}),r.jsx("div",{className:"button-row",children:y?',start);
if(start<0||end<0)throw Error('Document preview changed');
s=s.slice(0,start)+'}),y&&cropControls(r.jsx,y,m,C)'+s.slice(end);
change('y.length<4?"請點選文件的"+["左上角","右上角","右下角","左下角"][y.length]:"四角已選取"','"拖曳框線四邊的控制點或四個角，調整後套用。"');
change('b(()=>jm(u,y),"正在校正…")','b(async()=>{const src=original.current?.source??u;const result=await jm(src,y);original.current={source:src,points:y};return result},"正在校正…")');
change('onClick:()=>m(null),children:"取消框選"','onClick:()=>{d(original.current.preview);m(null)},children:"取消框選"');
change('b(()=>jm(u,[],!0),"正在旋轉…")','b(async()=>{const rotated=await jm(u,[],true);original.current={source:rotated,points:rect()};return rotated},"正在旋轉…")');
change('onClick:()=>m([]),children:"四角校正／裁切"','onClick:()=>{const file=original.current??{source:u,points:rect()};original.current={...file,preview:u};d(file.source);m(file.points)},children:"調整裁切範圍"');
s='import {contentTopic,orderedTags} from "'+asset+'-topics.js";import {rect,detect,sidewaysText,cropControls} from "'+asset+'-crop.js";\n'+s;
const out=asset+'-'+crypto.createHash('sha256').update(s).digest('hex').slice(0,12)+'.js';
write(out,s);write('index.html',html.replace(entry,out).replace('</head>','<link rel="stylesheet" href="'+asset+'-crop.css"></head>'));
for(const name of ['entry','topics']){
  const file='topics/'+name+'.js';s=read(file);
  if(name==='entry')change('for(const t of data.tags)','for(const t of orderedTags(data.tags))');
  else change("model=await api('');","model=await api('');model.tags=orderedTags(model.tags);for(const row of model.rows)row.tags=orderedTags(row.tags);");
  write(file,'import {orderedTags} from "'+asset+'-topics.js";\n'+s);
}


