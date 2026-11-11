const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const root=process.argv[2],index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8');
const old=html.match(/src="(\/assets\/[^"]+\.js)"/)[1],bundle=fs.readFileSync(path.join(root,old),'utf8');
const start=bundle.indexOf('function $7(){'),end=bundle.indexOf('const Z7=',start);
if(start<0||end<0)throw Error('Missing member directory');
let view=bundle.slice(start,end);
function edit(from,to){
  if(view.split(from).length!==2)throw Error('Unexpected directory baseline: '+from);
  view=view.replace(from,()=>to);
}
edit('const r=At(),','const r=At(),[editing,setEditing]=f.useState(()=>{const params=new URLSearchParams(location.search);const type=params.get("identityType"),id=params.get("identityId");return identityNames[type]&&id?{type,id}:null}),');
edit('[v,j]=f.useState(null),','[selectedPerson,j]=f.useState(null),repQuery=Le({queryKey:["entity-account",g?.legalEntityId,selectedPerson?.personId],enabled:!!g&&!!selectedPerson,queryFn:({signal})=>le("/admin/persons/"+selectedPerson.personId,{signal})}),v=g?repQuery.data?.data:selectedPerson,');
edit('queryKey:["person-owned-qualifications",v==null?void 0:v.personId,C],queryFn:()=>le("/admin/persons/"+v.personId+"/qualifications"+ze({take:20,skip:C})),enabled:!!v',
     'queryKey:["person-owned-qualifications",g?"entity":"person",g?.legalEntityId??v?.personId,C],queryFn:({signal})=>le((g?"/admin/persons/entities/"+g.legalEntityId:"/admin/persons/"+v.personId)+"/qualifications"+ze({take:20,skip:C}),{signal}),enabled:!!g||!!v');
edit('function Pe(D){j(D),b(null),A(0)}','function Pe(D){j(D),b(null),A(0),resetAccount()} function resetAccount(){_ (""),k(""),H(""),q(""),P.reset(),F.reset()} function chooseAccount(person){j(person);resetAccount()} function closeEditor(){setEditing(null);const url=new URL(location.href);if(url.searchParams.has("identityId")){url.searchParams.delete("identityType");url.searchParams.delete("identityId");history.replaceState(history.state,"",url)}} function savedIdentity(subject){Ve();r.invalidateQueries({queryKey:["persons"]});r.invalidateQueries({queryKey:["entity-account"]});r.invalidateQueries({queryKey:["person-owned-qualifications"]});r.invalidateQueries({queryKey:["member-identity-editor"]});setEditing(subject)}');
edit('render:D=>e.jsx("a",{href:"/member-type/?type="+encodeURIComponent(D.memberType)+"&id="+encodeURIComponent(D.memberType==="LEGAL_ENTITY"?D.legalEntityId:D.personId),children:"會員身分維護"})',
     'render:D=>e.jsx("button",{type:"button","aria-haspopup":"dialog",onClick:()=>setEditing({type:D.memberType,id:D.legalEntityId??D.personId}),children:"會員身分維護"})');
edit('"aria-expanded":(v==null?void 0:v.personId)===D.personId,onClick:()=>{D.memberType==="LEGAL_ENTITY"?(j(null),y(D)):(y(null),Pe(D))},children:D.memberType==="LEGAL_ENTITY"?"查看法人":"查看會員 360"',
     '"aria-expanded":D.memberType==="LEGAL_ENTITY"?g?.legalEntityId===D.legalEntityId:!g&&v?.personId===D.personId,onClick:()=>{if(D.memberType==="LEGAL_ENTITY"){y(D);Pe(D.representatives?.length===1?D.representatives[0]:null)}else{y(null);Pe(D)}},children:"查看會員 360"');
const corpStart=view.indexOf('e.jsx(_o,{open:!!g,title:g?'),personStart=view.indexOf('e.jsx(_o,{open:!!v,title:v?',corpStart);
if(corpStart<0||personStart<0)throw Error('Missing drawers');
view=view.slice(0,corpStart)+'editing&&e.jsx(IdentityDrawer,{subject:editing,onClose:closeEditor,onSaved:savedIdentity},editing.type+editing.id),'+view.slice(personStart);
edit('open:!!v,title:v?"會員 360 · "+Md(v):"會員 360",onClose:Ve,children:v&&','open:!!g||!!v,title:g?"會員 360 · "+g.legalName:v?"會員 360 · "+Md(v):"會員 360",onClose:Ve,children:(g||v)&&');
edit('"aria-live":"polite",children:[e.jsxs("dl",','"aria-live":"polite",children:[g&&e.jsx(CorporateSummary,{entity:g,selected:selectedPerson,choose:chooseAccount,personQuery:repQuery}),g&&v&&e.jsx("h3",{children:"經營代表人帳號 · "+v.legalName}),v&&e.jsxs("dl",');
edit('e.jsx(TE,{id:v.personId','v&&e.jsx(TE,{id:v.personId');
edit('onChanged:D=>{j(D),r.invalidateQueries','onChanged:D=>{if(g){r.invalidateQueries({queryKey:["entity-account",g.legalEntityId]})}else{j(D)}r.invalidateQueries');
edit('id:"person-ball-portfolio",children:L("Ball Portfolio")','id:"person-ball-portfolio",children:g?"法人持有的會員球":L("Ball Portfolio")');
edit('e.jsxs("section",{"aria-labelledby":"person-retail-attribution"','v&&e.jsxs("section",{"aria-labelledby":"person-retail-attribution"');
edit('e.jsxs("section",{"aria-labelledby":"person-account-security"','v&&e.jsxs("section",{"aria-labelledby":"person-account-security"');
function asset(body,ext){
 const name='/assets/member-directory-'+crypto.createHash('sha256').update(body).digest('hex').slice(0,12)+'.'+ext;
 fs.writeFileSync(path.join(root,name),body);return name;
}
const editor=ts.transpileModule(fs.readFileSync(path.join(__dirname,'identity.jsx'),'utf8'),{fileName:'identity.jsx',compilerOptions:{allowJs:true,jsx:ts.JsxEmit.React,jsxFactory:'f.createElement',jsxFragmentFactory:'f.Fragment',target:ts.ScriptTarget.ES2020}}).outputText;
const js=asset(bundle.slice(0,start)+editor+'\n'+view+bundle.slice(end),'js');
const css=asset(fs.readFileSync(path.join(__dirname,'page.css')),'css');
fs.writeFileSync(index,html.replace(old,js).replace('</head>','<link rel="stylesheet" href="'+css+'"></head>'));
const legacy=asset("const p=new URLSearchParams(location.search),u=new URL('/people',location.origin);if(p.has('id')&&p.has('type')){u.searchParams.set('identityId',p.get('id'));u.searchParams.set('identityType',p.get('type'));}location.replace(u);",'js');
fs.writeFileSync(path.join(root,'member-type','index.html'),'<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>會員身分維護</title><a href="/people">返回會員資料</a><script src="'+legacy+'"></script></html>');
