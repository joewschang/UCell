const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=process.argv[2];
const index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8'),old=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];let js=fs.readFileSync(path.join(root,old),'utf8');
function edit(a,b){if(js.split(a).length!==2)throw Error(a);js=js.replace(a,()=>b);}
edit('function zR(){At();',fs.readFileSync(path.join(__dirname,'ball-field.js'),'utf8')+'\nfunction zR(){At();const [navFilter,setNavFilter]=f.useState("");const term=navFilter.trim().toLowerCase();');
edit('e.jsx("nav",{"aria-label":"後台主要功能"', 'e.jsx("input",{type:"search",className:"ux-nav-search","aria-label":"搜尋後台功能",placeholder:"搜尋後台功能",value:navFilter,onChange:event=>setNavFilter(event.target.value)}),term&&!KR.some(group=>group.paths.some(path=>NE.some(([title,url])=>url===path&&Ea(t?.role,path)&&(group.label+Ie(title)).toLowerCase().includes(term))))&&e.jsx("p",{className:"ux-nav-empty",role:"status",children:"沒有符合的功能"}),e.jsx("nav",{"aria-label":"後台主要功能"');
edit('NE.filter(([,m])=>m===h&&Ea(t==null?void 0:t.role,m))','NE.filter(([title,m])=>m===h&&Ea(t?.role,m)&&(c.label+Ie(title)).toLowerCase().includes(term))');
edit('open:c.paths.includes(i??"")','open:!!term||c.paths.includes(i??"")');
edit('u.map(([h,m,p])=>e.jsxs(It,{to:m,','u.map(([h,m,p])=>e.jsxs(It,{to:m,onClick:()=>setNavFilter(""),');
for(const [anchor,effective] of [['required:!0,placeholder:"輸入完整球號",value:i',false],['id:"ct-search-ball",value:y',false],['value:U,onChange:D=>k(D.target.value.toUpperCase())',true],['value:l.sponsorBallNo??"",maxLength:48',true],['value:R,maxLength:80,onChange:ee=>N(ee.target.value.toUpperCase())',true]]){
 edit('e.jsx("input",{'+anchor,'e.jsx(UcBallField,{effective:'+effective+','+anchor);
}
edit('?r.planLevelCode:L("Plan 未提供")','?({STARTER:"啟航",ELITE:"菁英",LEADER:"領袖"}[r.planLevelCode]??r.planLevelCode):L("Plan 未提供")');
edit('e.jsx("input",{inputMode:"numeric",pattern:"[0-9]{1,19}",value:t.qualificationNo','e.jsx(UcBallField,{numberOnly:true,inputMode:"numeric",pattern:"[0-9]{1,19}",value:t.qualificationNo');
const css=fs.readFileSync(path.join(__dirname,'admin.css'));
function save(content,ext){const file='/assets/admin-ux-'+crypto.createHash('sha256').update(content).digest('hex').slice(0,12)+'.'+ext;fs.writeFileSync(path.join(root,file),content);return file;}
fs.writeFileSync(index,html.replace(old,save(js,'js')).replace('</head>','<link rel="stylesheet" href="'+save(css,'css')+'"></head>'));
const topicsIndex=path.join(root,'topics','index.html');
const topicsHtml=fs.readFileSync(topicsIndex,'utf8');
const themeScript=save(fs.readFileSync(path.join(__dirname,'topics-theme.js')),'js');
const themeStyle=save(fs.readFileSync(path.join(__dirname,'topics-dark.css')),'css');
fs.writeFileSync(topicsIndex,topicsHtml.replace('</head>','<link rel="stylesheet" href="'+themeStyle+'"><script defer src="'+themeScript+'"></script></head>'));
