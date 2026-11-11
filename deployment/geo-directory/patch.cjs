const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const root=process.argv[2],index=path.join(root,'index.html');
const html=fs.readFileSync(index,'utf8'),oldAsset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
let js=fs.readFileSync(path.join(root,oldAsset),'utf8');
const pickerStart=js.indexOf('function TreeRootPicker('),pickerEnd=js.indexOf('function DailyGreetingAdmin(',pickerStart);
if(pickerStart<0 || pickerEnd<0)throw Error('Missing shared tree picker');
const picker=fs.readFileSync(path.join(__dirname,'../tree-greetings/tree-picker.jsx'),'utf8');
const compiled=ts.transpileModule(picker,{fileName:'tree-picker.jsx',compilerOptions:{allowJs:true,jsx:ts.JsxEmit.React,jsxFactory:'f.createElement',target:ts.ScriptTarget.ES2020}}).outputText;
js=js.slice(0,pickerStart)+compiled+'\n'+js.slice(pickerEnd);
const start=js.indexOf('function OR(){'),end=js.indexOf('function ',js.indexOf('geo-page',start));
if(start<0||end<=start)throw Error('Missing geo page');
let geo=js.slice(start,end);
function edit(before,after){
  if(geo.split(before).length!==2)throw Error('Unexpected geo page: '+before);
  geo=geo.replace(before,()=>after);
}
edit('const{user:r}=Et(),','const formRef=f.useRef(null),[picked,setPicked]=f.useState(null),{user:r}=Et(),');
edit('async function he(Ce){var wt;if(!Je){Ce.preventDefault();return}Ce.preventDefault();','async function he(Ce,root=i){var wt;Ce?.preventDefault();if(!Je)return;');
edit('RR({root:i,','RR({root,');
const form='e.jsxs("form",{onSubmit:he,className:"geo-filters",children:[';
const input='e.jsx(J,{label:"根球號",children:e.jsx(UcBallField,{effective:false,required:!0,placeholder:"輸入完整球號",value:i,onChange:Ce=>{re(),o(Ce.target.value)}})}),';
edit(form+input,`Je&&e.jsx(TreeRootPicker,{geo:true,value:picked??{primary:i},onChange:option=>{
  re();o(option.primary);setPicked(option);
  if(formRef.current?.reportValidity())void he(null,option.primary);
}}),i&&e.jsxs("p",{role:"status",children:["已選根球：",picked?.secondary?picked.secondary+" · ":"",i]}),
e.jsxs("form",{ref:formRef,onSubmit:he,className:"geo-filters",children:[`);
edit('disabled:U||!Je,children:U?', 'disabled:U||!Je||!i,children:U?');
js=js.slice(0,start)+geo+js.slice(end);
const asset='/assets/geo-directory-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,asset),js);fs.writeFileSync(index,html.replace(oldAsset,asset));
