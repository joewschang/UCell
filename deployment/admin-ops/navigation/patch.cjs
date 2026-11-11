const fs = require('node:fs');
const path = require('node:path');

function replaceOnce(source, search, replacement) {
  const index = source.indexOf(search);
  if (index === -1 || source.indexOf(search, index + search.length) !== -1) {
    throw Error('Expected one admin directory anchor: ' + search.slice(0, 64));
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function patchNavigation(source) {
  if (source.includes('const UcOpsDirectory=(()=>')) return source;
  const shell = 'function zR(){At();const [navFilter,setNavFilter]=f.useState("");const term=navFilter.trim().toLowerCase();';
  const search = 'e.jsx("input",{type:"search",className:"ux-nav-search"';
  const footer = 'e.jsxs("div",{className:"sidebar-foot"';
  const start = source.indexOf(search), end = source.indexOf(footer, start);
  if (start < 0 || end < start || end - start > 3000) throw Error('Admin sidebar search boundaries changed');
  const existing = source.slice(start, end);
  for (const expected of ['KR.map(', 'Ea(t?.role,m)', 'reloadDocument:m==="/topics/"', 'Ie(c.label)']) {
    if (!existing.includes(expected)) throw Error('Expected existing admin navigation ' + expected);
  }
  const compiled = path.join(__dirname, 'directory.js');
  const component = fs.existsSync(compiled) ? fs.readFileSync(compiled, 'utf8') : require('./compile.cjs').compileDirectory();
  const nav = 'e.jsx(UcOpsDirectory,{role:t?.role,current:i,pathname:r}),';
  return replaceOnce(replaceOnce(source, existing, nav), shell, component + '\nfunction zR(){At();');
}

if (require.main === module) {
  const bundle = process.argv[2];
  if (!bundle) throw Error('Usage: node navigation/patch.cjs <main-bundle-path>');
  const before = fs.readFileSync(bundle, 'utf8');
  const after = patchNavigation(before);
  if (before !== after) fs.writeFileSync(bundle, after);
}
module.exports = {patchNavigation};
