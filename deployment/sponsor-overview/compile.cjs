const fs = require('node:fs');
const path = require('node:path');
const admin = path.resolve(__dirname, '../../admin');
const ts = require(require.resolve('typescript', { paths: [admin] }));
const features = path.join(admin, 'src/features/organization');
function compile(filename) {
  const input = fs.readFileSync(path.join(features, filename), 'utf8');
  const compiled = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
    reportDiagnostics: true
  });
  if (compiled.diagnostics?.length) throw Error(ts.formatDiagnosticsWithColorAndContext(compiled.diagnostics, ts.sys));
  return compiled.outputText.replace(/^import .*?;\r?\n/gm, '').replace(/^export /gm, '');
}
const destination = process.argv[2];
if (!destination) throw Error('Provide a destination file for the component');
const runtime = [
  'const SponsorOverview = (() => {',
  'const {jsx:_jsx, jsxs:_jsxs, Fragment:_Fragment}=e;',
  'const {useEffect,useLayoutEffect,useMemo,useRef,useState}=f;',
  'const useQuery=Le, DetailDrawer=_o, get=le;',
  compile('sponsor-map-layout.ts'),
  compile('SponsorOverview.tsx'),
  'return SponsorOverview;',
  '})();'
].join('\n');
if (/^import\b|^export\b/m.test(runtime)) throw Error('Unexpected module import in standalone component');
fs.mkdirSync(path.dirname(path.resolve(destination)), {recursive:true});
fs.writeFileSync(destination, runtime);
