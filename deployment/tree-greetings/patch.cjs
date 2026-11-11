const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ts=require('typescript');
const root=process.argv[2];
const index=path.join(root,'index.html');
const html=fs.readFileSync(index,'utf8');
const oldAsset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
let bundle=fs.readFileSync(path.join(root,oldAsset),'utf8');
function edit(from,to){
  if(bundle.split(from).length!==2) throw Error('Unrecognized base: '+from);
  bundle=bundle.replace(from,()=>to);
}
function compile(file){
  const input=fs.readFileSync(path.join(__dirname,file),'utf8');
  return ts.transpileModule(input,{fileName:file,compilerOptions:{
    allowJs:true,jsx:ts.JsxEmit.React,jsxFactory:'f.createElement',jsxFragmentFactory:'f.Fragment',target:ts.ScriptTarget.ES2020
  }}).outputText;
}
function asset(body,ext){
  const hash=crypto.createHash('sha256').update(body).digest('hex').slice(0,12);
  const name='/assets/tree-greetings-'+hash+'.'+ext;
  fs.writeFileSync(path.join(root,name),body);
  return name;
}

edit('function Jy({initialMode:',compile('tree-picker.jsx')+'\n'+compile('greetings.jsx')+'\nfunction Jy({initialMode:');
const start=bundle.indexOf('async function U(H){return(await le("/admin/qualifications"');
const end=bundle.indexOf('async function k(H=o)',start);
if(start===-1||end===-1||end-start>900)throw Error('Unrecognized tree filter');
bundle=bundle.slice(0,start)+bundle.slice(end);
edit('e.jsx(ar,{label:"根球球號",placeholder:"輸入完整球號或球號前綴",value:o,','e.jsx(TreeRootPicker,{value:o,');
edit('H&&k(H)},search:U})','H&&k(H)}})');
edit('請搜尋並點選根球球號，系統會立即載入組織。','從上方清單選擇一顆球，即可查看組織。');
edit('"已選擇球號：",e.jsx("strong",{children:o.primary})','"已選擇：",e.jsx("strong",{children:[o.secondary," · ",o.primary]})');

edit('["標籤管理","/topics/","content"]','["每日問候圖上傳","/content/greetings","content"],["標籤管理","/topics/","content"]');
edit('label:"內容與客服",paths:["/content",','label:"內容與客服",paths:["/content","/content/greetings",');
edit('GR={"/topics/":','GR={"/content/greetings":["SUPER_ADMIN","ORDER_OPS","COMPLIANCE_AUDIT"],"/topics/":');
edit('e.jsx(lt,{path:"/organization",','e.jsx(lt,{path:"/content/greetings",element:e.jsx(ft,{children:e.jsx(DailyGreetingAdmin,{})})}),e.jsx(lt,{path:"/organization",');
if(!html.includes('<script src="/greetings/link.js"></script>'))throw Error('Missing legacy navigation');
fs.writeFileSync(index,html.replace(oldAsset,asset(bundle,'js')).replace('<script src="/greetings/link.js"></script>','')
  .replace('</head>','<link rel="stylesheet" href="'+asset(fs.readFileSync(path.join(__dirname,'page.css')),'css')+'"></head>'));
fs.writeFileSync(path.join(root,'greetings','index.html'),'<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/content/greetings"><title>每日問候圖上傳</title><a href="/content/greetings">開啟每日問候圖上傳</a></html>');
