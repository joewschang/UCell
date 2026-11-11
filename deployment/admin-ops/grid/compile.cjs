const path = require('node:path');
const fs = require('node:fs');
const admin = path.resolve(__dirname,'../../../admin');
const ts = require(require.resolve('typescript', {paths:[admin]}));
const component = path.join(admin, 'src/components/AdminDataGrid.tsx');
const source = fs.readFileSync(component,'utf8');
const code = ts.transpileModule(source,{fileName:component, compilerOptions:{
  target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext, jsx:ts.JsxEmit.ReactJSX
}}).outputText;
const start = 'export function AdminDataGrid(';
if(!code.includes(start)) throw Error('Missing AdminDataGrid export');
const body = code.slice(code.indexOf(start)).replace(start,'function Jl(').replace(' const [search,',
  ' const {useState}=f, {jsx:_jsx,jsxs:_jsxs}=e, uiText=L, uiValue=Ie, UCellButton=os, EmptyState=Vn, FilterBar=uy;\n    const [search,');
if(!body.includes('{useState}=f')) throw Error('Missing grid hooks');
fs.writeFileSync(process.argv[2],body);
