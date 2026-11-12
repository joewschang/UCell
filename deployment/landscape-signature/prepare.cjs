const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const member = createRequire(path.resolve(__dirname, '../../member/package.json'));
const esbuild = createRequire(member.resolve('vite/package.json'))('esbuild');

const digest = data => createHash('sha256').update(data).digest('hex');

function replaceOnce(source, old, next) {
  const start = source.indexOf(old);
  if (start < 0 || source.indexOf(old, start + 1) >= 0) throw Error('Unrecognized signature release anchor: ' + old.slice(0, 72));
  return source.slice(0, start) + next + source.slice(start + old.length);
}

function section(source, startMark, endMark) {
  const start = source.indexOf(startMark);
  const end = source.indexOf(endMark, start + startMark.length);
  if (start < 0 || end < 0) throw Error('Missing signature release section: ' + startMark);
  return source.slice(start, end);
}

function changeSection(source, start, end, next) {
  return replaceOnce(source, section(source, start, end), next);
}

// These two entry points ship in the existing member bundle. Guard the actual
// component bodies so unrelated updates to the rest of the site can coexist.
function integrate(bundle, pad) {
  const enrollment = section(bundle, 'function Fl({applicationId:', 'async function jm(');
  const resign = section(bundle, 'function Em({task:', 'function Xf({compact:');
  if (digest(enrollment) !== '2a1201da88c16aa4c3644001bcc780d417a58558a951e7205365240acc54c272' ||
      digest(resign) !== '7a284c6f969269ec556f9beeb4f9e8a415a02f086ec89d44a28b1383e97c4fea') {
    throw Error('Signature integration has changed. Review the two member entry points before packaging.');
  }
  let formal = changeSection(enrollment, ',l=h.useRef(!1)', ',[d,f]=', '');
  formal = changeSection(formal, ',b=h.useRef(null)', ',[C,I]=', '');
  formal = replaceOnce(formal, ',F=h.useRef(null);', ';');
  formal = replaceOnce(formal, ',[T,M]=h.useState(!1)', '');
  formal = changeSection(formal, 'function $(H){', 'async function Z(){', '');
  formal = replaceOnce(formal, 'V(!1),v(!1)},[(fe=', 'V(!1),v(!1),f(!1),g(!1),N(null),k.current++,L(!1)},[e,(fe=');
  formal = changeSection(formal, 'r.jsxs("div",{hidden:C!=="draw"', 'C==="photo"&&r.jsxs("div",{className:"signature-photo"',
    'r.jsx("div",{hidden:C!=="draw",children:r.jsx(UCellLandscapePad,{canvasRef:a,disabled:x,onInkChange:valid=>{f(valid);g(false)}},e+"|"+(o.data.signingContext?.snapshotHash??""))}),');
  formal = replaceOnce(formal, 'C==="draw"&&r.jsx(A,{busy:!!x,error:j,type:"button",disabled:x,onClick:z,children:"清除重簽"}),', '');

  let approved = replaceOnce(resign, ',y=h.useRef(null)', '');
  approved = changeSection(approved, 'function S(I){', 'return r.jsxs("article"', '');
  approved = changeSection(approved, 'r.jsx("p",{children:"請在下方親筆簽名"})', 'r.jsxs("label",{children:[r.jsx("input",{type:"checkbox",disabled:p,checked:a',
    'r.jsx(UCellLandscapePad,{canvasRef:m,disabled:p,onInkChange:valid=>{E(valid);l(false)},onVectorsChange:ink=>{j.current=ink}},n.digest),');

  const component = 'const UCellLandscapePad=(function(react,jsxRuntime){\n' + pad +
    '\nreturn UCellLandscapeSignature.default;\n})(h,r);\n';
  return replaceOnce(replaceOnce(bundle, resign, component + approved), enrollment, formal);
}

async function compilePad() {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'SignaturePad.tsx')],
    bundle: true, write: false, jsx: 'automatic', format: 'iife',
    globalName: 'UCellLandscapeSignature', minify: true, charset: 'utf8',
    legalComments: 'none', target: 'es2020',
    plugins: [{ name: 'member-react', setup(build) {
      build.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, args => ({ path: args.path, namespace: 'member' }));
      build.onLoad({ filter: /.*/, namespace: 'member' }, args => ({
        contents: args.path === 'react'
          ? 'export const {useEffect,useId,useLayoutEffect,useRef,useState}=react;'
          : 'export const {jsx,jsxs,Fragment}=jsxRuntime;'
      }));
    } }]
  });
  return result.outputFiles[0].text;
}

async function prepare(input, output, imageContext) {
  const html = fs.readFileSync(path.join(input, 'index.html'), 'utf8');
  const entry = html.match(/<script\b[^>]*src="(\/assets\/[\w.-]+\.js)"[^>]*><\/script>/)?.[1];
  if (!entry) throw Error('Cannot identify the member entry script');
  const original = fs.readFileSync(path.join(input, entry), 'utf8');
  const script = integrate(original, await compilePad());
  const css = fs.readFileSync(path.join(__dirname, 'signature-pad.css'));
  const newEntry = '/assets/member-signature-' + digest(script).slice(0, 16) + '.js';
  const newStyle = '/assets/member-signature-' + digest(css).slice(0, 16) + '.css';
  const next = replaceOnce(replaceOnce(html, entry, newEntry), '</head>', '<link rel="stylesheet" href="' + newStyle + '"></head>');
  fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(output, newEntry), script);
  fs.writeFileSync(path.join(output, newStyle), css);
  fs.writeFileSync(path.join(output, 'index.html'), next);
  if (imageContext) {
    const overlay = path.join(imageContext, 'overlay');
    fs.mkdirSync(path.join(overlay, 'assets'), { recursive: true });
    for (const file of ['index.html', newEntry, newStyle]) {
      fs.copyFileSync(path.join(output, file), path.join(overlay, file));
    }
    // A pinned image must contain exactly the HTML and entry we verified.
    fs.writeFileSync(path.join(imageContext, 'base.sha256'),
      digest(html) + '  index.html\n' + digest(original) + '  ' + entry.slice(1) + '\n');
    fs.copyFileSync(path.join(__dirname, 'Dockerfile'), path.join(imageContext, 'Dockerfile'));
  }
  console.log(newEntry, newStyle);
}

if (require.main === module) {
  const [, , input, output, imageContext] = process.argv;
  if (!input || !output) throw Error('Usage: node prepare.cjs <running-member-site> <release-overlay> [image-context]');
  prepare(input, output, imageContext).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { compilePad, integrate, prepare };
