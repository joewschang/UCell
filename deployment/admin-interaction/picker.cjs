'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {createRequire} = require('node:module');

function pickerModule() {
  const admin = path.resolve(__dirname, '../../admin');
  const project = createRequire(path.join(admin, 'package.json'));
  const esbuild = createRequire(project.resolve('vite/package.json'))('esbuild');
  const source = fs.readFileSync(path.join(admin, 'src/features/qualifications/BallPicker.tsx'), 'utf8');
  const compiled = esbuild.transformSync(source, {loader: 'tsx', jsx: 'automatic', format: 'cjs', target: 'es2020', minify: true, charset: 'utf8'}).code;
  const host = '{"react":f,"react/jsx-runtime":e,"@tanstack/react-query":{useQuery:Le},"react-router-dom":{useSearchParams:Ui},"../../lib/api":{get:le,qs:ze}}';
  return 'const UCellQualificationPicker=((hostModules)=>{const module={exports:{}};const require=name=>hostModules[name];' + compiled + ';return module.exports})(' + host + ')';
}

function patchPicker(main) {
  const start = main.indexOf('function R8()');
  const end = main.indexOf('function N8({rows:r,onSaved:t})', start);
  assert(start >= 0 && end > start, 'The qualification directory was not found');
  const previous = main.slice(start, end);
  assert.equal(createHash('sha256').update(previous).digest('hex'), '2b34205522a0cadf83e331e7b69192889ab07f1b98288b400b6c62bb3742b67a', 'Inspect the changed qualification directory before applying this adapter');
  const coverageStart = previous.indexOf('m=h.map(');
  const headerStart = previous.indexOf('e.jsxs(e.Fragment,{children:[e.jsx(jt,{title:"會員資格一覽"');
  const filterStart = previous.indexOf('e.jsxs("div",{className:"toolbar",role:"search"', headerStart);
  const header = previous.slice(headerStart, filterStart).replace('p.isError&&', 'd.showCoverage&&p.isError&&');
  const coverage = previous.slice(coverageStart, previous.indexOf(';return f.useEffect(', coverageStart)).replace('enabled:!!m', 'enabled:!!m&&d.showCoverage');
  const detailStart = previous.lastIndexOf('e.jsx(ae,{title:L("Ball 360")');
  const suffix = ']})]})}';
  assert(coverageStart > 0 && headerStart > coverageStart && filterStart > headerStart && detailStart > filterStart && previous.endsWith(suffix));
  const detail = previous.slice(detailStart, -suffix.length);
  const facts = 'v=>{const j=b8(v);return e.jsxs(e.Fragment,{children:[XR(v)," · ",S8(v),e.jsx(ot,{tone:"neutral",children:v.status==="DRAFT"?"尚未啟用":Ie(v.status)}),e.jsx(ot,{tone:j.tone,children:Ie(j.label)})]})}';
  const replacement = pickerModule() + ';function R8(){const d=UCellQualificationPicker.useBallDirectory(),l=d.selected,h=d.rows,' + coverage
    + ';return ' + header + 'e.jsx(UCellQualificationPicker.BallPicker,{directory:d,holder:Ws,facts:' + facts + ',coverage:v=>g(v.qualificationId),children:' + detail + '})]})}';
  return main.slice(0, start) + replacement + main.slice(end);
}
module.exports = {patchPicker};
