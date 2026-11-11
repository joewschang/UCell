const fs = require('node:fs');
const path = require('node:path');

function compileDirectory() {
  const admin = path.resolve(__dirname, '../../../admin');
  const entry = path.join(admin,'src/app/OperationsDirectory.tsx');
  const ts = require(require.resolve('typescript',{paths:[admin]}));
  const compiled = ts.transpileModule(fs.readFileSync(entry,'utf8'),{
    fileName:entry, compilerOptions:{target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext, jsx:ts.JsxEmit.ReactJSX}
  }).outputText;
  const start = compiled.indexOf('const ucOpsNavTerms =');
  if (start < 0 || !compiled.includes('export function OperationsDirectory(')) throw Error('Directory export changed');
  const body = compiled.slice(start).replace('export function OperationsDirectory(', 'function OperationsDirectory(');
  return `const UcOpsDirectory=(()=>{
  const {jsx:_jsx,jsxs:_jsxs,Fragment:_Fragment}=e;
  const {useState,useRef,useEffect}=f;
  const nav=NE, navGroups=KR, canOpen=Ea, Link=It, UCellIcon=PI, uiValue=Ie;
  ${body}
  return OperationsDirectory;
})();`;
}
if (require.main === module) fs.writeFileSync(process.argv[2],compileDirectory());
module.exports = {compileDirectory};
