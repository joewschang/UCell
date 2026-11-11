const fs = require('node:fs');
const path = require('node:path');
const admin = path.resolve(__dirname,'../../../admin');
const ts = require(require.resolve('typescript',{paths:[admin]}));

function compileReport(destination) {
  const sourceDir = path.join(admin,'src/features/reports');
  const sourceFile = path.join(sourceDir,'ReportsPage.tsx');
  const output = ts.transpileModule(fs.readFileSync(sourceFile,'utf8'),{
    fileName:sourceFile, compilerOptions:{
      target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext, jsx:ts.JsxEmit.ReactJSX
    }
  }).outputText;
  const code = output.replace(/^import .*;\r?\n/gm,'').replace(/^export function /gm,'function ');
  if (/^import |^export /m.test(code) || !code.includes('function ReportsPage()')) throw Error('Unexpected report compilation');
  const runtime = 'const {jsx:_jsx,jsxs:_jsxs,Fragment:_Fragment}=e,{useState,useRef}=f;' +
    'const useQuery=Le,domainLabel=We,AdminTable=kt,QueryFeedback=pt,Badge=ot,Card=ae,ErrorBox=De,Field=J,Metric=Qe,PageHeader=jt,get=le,qs=ze,useAuth=Et;';
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,'const IN=(()=>{\n'+runtime+'\n'+code+'\nreturn ReportsPage;\n})();\n');
  fs.copyFileSync(path.join(sourceDir,'report.css'),path.join(path.dirname(destination),'report.css'));
}
module.exports = {compileReport};
if(require.main===module) compileReport(process.argv[2]);
