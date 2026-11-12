const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {renameBinaryTree} = require('./rename.cjs');

const root = path.resolve(process.argv[2]);
const assets = path.join(root, 'assets');
const previous = 'sponsor-overview-7a0befe1b3beabf6.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const original = fs.readFileSync(path.join(assets, previous), 'utf8');
if (hash(original) !== 'e7ea81dfa6e14c2e4b7de80bd695bb0e3fe06eb115e739bdd91e30af33cd47b4') {
  throw Error('Unexpected admin shell. Check the active image before rebuilding.');
}
const css = fs.readFileSync(path.join(__dirname, 'binary-overview.css'), 'utf8');
let main = renameBinaryTree(original);
const lazyAssets = [...new Set([...main.matchAll(/import\("\.\/([^"]+\.js)"\)/g)].map(match => match[1]))];
if (lazyAssets.length !== 3) throw Error('The admin import graph changed');
const lazy = lazyAssets.map(name => ({name, code: fs.readFileSync(path.join(assets, name), 'utf8')}));
const version = hash([main, css, ...lazy.map(file => file.code)].join('\n')).slice(0, 16);
const newMain = 'binary-overview-' + version + '.js';
const newCss = 'binary-overview-' + hash(css).slice(0, 16) + '.css';

// Vite's lazy pages import shared bindings from the entry module. Update both
// ends and the preload table so every route uses the same React instance.
for (const {name, code} of lazy) {
  const from = 'from"./' + previous + '"';
  if (code.split(from).length !== 2) throw Error('Unexpected shared imports in ' + name);
  const nextName = name.split('-ops-')[0] + '-binary-' + version + '.js';
  fs.writeFileSync(path.join(assets, nextName), code.replace(from, 'from"./' + newMain + '"'));
  main = main.replaceAll('"./' + name + '"', '"./' + nextName + '"')
             .replaceAll('"assets/' + name + '"', '"assets/' + nextName + '"');
}
fs.writeFileSync(path.join(assets, newMain), main);
fs.writeFileSync(path.join(assets, newCss), css);
function patchEntries(dir) {
  for (const f of fs.readdirSync(dir, {withFileTypes:true})) {
    const file = path.join(dir, f.name);
    if (f.isDirectory()) { patchEntries(file); continue; }
    if (!f.name.endsWith('.html')) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('/assets/' + previous)) continue;
    if (html.split('</head>').length !== 2) throw Error('Unexpected HTML in ' + file);
    fs.writeFileSync(file, html.replaceAll('/assets/' + previous, '/assets/' + newMain)
      .replace('</head>', '<link rel="stylesheet" href="/assets/' + newCss + '"></head>'));
  }
}
patchEntries(root);
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
if (!html.includes('/assets/' + newMain) || !html.includes('/assets/' + newCss)) throw Error('Admin entry was not updated');
console.log(JSON.stringify({main:newMain, css:newCss, lazy:lazyAssets.length}));
