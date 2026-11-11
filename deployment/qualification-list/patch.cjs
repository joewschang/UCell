const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8');
const asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];let js=fs.readFileSync(path.join(root,asset),'utf8');
function edit(old,value){
 if(js.split(old).length!==2)throw Error('Unexpected bundle near '+old.slice(0,65));
 js=js.replace(old,()=>value);
}
edit('function R8(){var y;', 'function R8(){const [listOpen,setListOpen]=f.useState(true);var y;');
edit('e.jsxs("div",{className:"uc-master-detail",children:[e.jsx(ae,{title:`Ball 清單',
 'e.jsx("button",{type:"button","aria-expanded":listOpen,"aria-controls":"qualification-ball-list",onClick:()=>setListOpen(open=>!open),children:listOpen?"收合球清單":"展開球清單"}),e.jsxs("div",{className:"uc-master-detail",style:listOpen?undefined:{gridTemplateColumns:"minmax(0,1fr)"},children:[e.jsx("div",{id:"qualification-ball-list",hidden:!listOpen,children:e.jsx(ae,{title:`Ball 清單');
edit('}),e.jsx(ae,{title:L("Ball 360"),children:e.jsx("section",{id:"ball-detail"', '})}),e.jsx(ae,{title:L("Ball 360"),children:e.jsx("section",{id:"ball-detail"');
edit('rank:`方案 ${S}`}),e.jsx("p",{className:"uc-muted",children:gj`樹號', 'rank:`方案 ${S}`}),e.jsxs("p",{children:["持有人：",e.jsx("strong",{children:v?"公司球":Ws(g)})]}),e.jsx("p",{className:"uc-muted",children:gj`樹號');
const url='/assets/qualification-list-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,url),js);fs.writeFileSync(index,html.replace(asset,url));
