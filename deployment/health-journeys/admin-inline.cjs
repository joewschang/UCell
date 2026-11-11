'use strict';
const fs=require('node:fs'),path=require('node:path');
function once(text,needle,replacement){
 if(text.split(needle).length!==2)throw Error('Unexpected admin baseline at '+needle);
 return text.replace(needle,()=>replacement);
}
module.exports=function install(root){
 const read=file=>fs.readFileSync(path.join(root,file),'utf8');
 const write=(file,data)=>fs.writeFileSync(path.join(root,file),data);
 const index=read('index.html');
 const entry=index.match(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"/)[1];
 const next=entry.replace(/\.js$/,'-inline.js');
 let bundle=read(entry);
 bundle=once(bundle,'reloadDocument:m==="/topics/"||m==="/health/journey/"','reloadDocument:m==="/topics/"');
 bundle=once(bundle,'e.jsx("a",{className:"button",href:"/health/",children:"健康中心管理 · 任務與標籤"})','e.jsx(It,{className:"button",to:"/health/journey/?view=settings",children:"健康中心管理 · 任務與標籤"})');
 const route='e.jsx(lt,{path:"/content/greetings",';
 bundle=once(bundle,route,`e.jsx(lt,{path:"/health/journey/",element:e.jsx(ft,{children:e.jsx(InlineHealthCenter,{})})}),e.jsx(lt,{path:"/health",element:e.jsx(pf,{to:"/health/journey/?view=settings",replace:!0})}),`+route);
 bundle=once(bundle,'GR[/^\\/admin','GR[/^\\/health\\/journey\\/?$/.test(t)?"/health/journey/":/^\\/admin');
 bundle=once(bundle,'function DailyGreetingAdmin()', 'const InlineHealthCenter=healthRoute(f,e.jsx,Lr,Au);\nfunction DailyGreetingAdmin()');
 write(next,'import {healthRoute} from "/health/journey/inline.js";\n'+bundle);
 write('index.html',once(once(index,entry,next),'</head>','<link rel="stylesheet" href="/health/journey/panel.css"></head>'));
 const dir='health/journey/';
 const ui=read('health/ui.js');
 write(dir+'elements.js',ui.slice(0,ui.indexOf('export const page=')));
 const settings=read('health/manage.js');
 write(dir+'settings-panel.js','export function mountSettings(page,{apiFor,el,box,btn,link,show}){\n'+settings.slice(settings.indexOf('const api='))+'\n}');
 let tags=read('topics/topics.js');
 tags=once(tags,"const admin=document.body.dataset.role==='admin';","const admin=true;");
 tags=once(tags,"const status=document.querySelector('#status'),tools=document.querySelector('#tools'),panel=document.querySelector('#panel');",
 "const status=document.createElement('p'),tools=document.createElement('section'),panel=document.createElement('div');status.setAttribute('role','status');page.append(el('h1','標籤管理'),status,tools,panel);");
 tags=tags.split('\n').filter(line=>!line.startsWith("if(admin){document.title=")&&!line.startsWith('window.onpopstate=')).join('\n');
 tags=once(tags,"load().then(()=>status.textContent='').catch(e=>{status.textContent=e.message;tools.append(btn('重新載入',()=>location.reload()));});","function retry(){load().then(()=>status.textContent='').catch(e=>{status.textContent=e.message;tools.replaceChildren(btn('重新載入',retry));});}retry();");
 tags=tags.replaceAll("history.pushState(null,'',u);render();","navigate(u.pathname+u.search);");
 write(dir+'tags-panel.js','export function mountTags(page,navigate){\n'+tags+'\n}');
 const config='/default.conf';
 const nginx=fs.readFileSync(config,'utf8');
 const locations=[
  '  location = /health/index.html { return 302 /health/$is_args$args; }',
  '  location = /health/journey/index.html { return 302 /health/journey/$is_args$args; }',
  '  location ~ ^/health(?:/journey)?/?$ { rewrite ^ /index.html last; }',
  '  location / {'
 ];
 fs.writeFileSync(config,once(nginx,'  location / {',locations.join('\n')));
};
