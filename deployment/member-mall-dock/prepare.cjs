'use strict';
// Usage: node prepare.cjs <ACR build context> [original index.html for a local preview]
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const baseImage = 'ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:386613bbd08badddd081b5c18e23bd6a7eeb7cbb985ba63bc5ccd448f316c803';
const baseHtmlHash = 'ef4e94062f911678b25ed815821dba1d6831020a36b865673a88edb584666c5b';
const sha256 = data => createHash('sha256').update(data).digest('hex');
const [output, originalIndex] = process.argv.slice(2);
assert(output, 'Supply a build context directory');

fs.mkdirSync(path.join(output, 'assets'), {recursive: true});
function prepareAsset(extension) {
  const source = path.resolve(__dirname, '../../member/src/mall-dock.' + extension);
  const contents = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
  const hash = sha256(contents);
  const url = '/assets/mall-dock-' + hash.slice(0, 16) + '.' + extension;
  fs.writeFileSync(path.join(output, url.slice(1)), contents);
  return {url, hash};
}
const css = prepareAsset('css');
const js = prepareAsset('js');
const links = '<link rel="stylesheet" href="' + css.url + '"><script type="module" src="' + js.url + '"></script>';
const manifest = {baseImage, baseHtmlHash, cssPath: css.url, cssHash: css.hash, jsPath: js.url, jsHash: js.hash};

// Build from the exact release and leave existing entry points and lazy imports intact.
const root = '/usr/share/nginx/html';
const dockerfile = [
  'FROM ' + baseImage,
  ...[css, js].map(asset => 'COPY ' + asset.url.slice(1) + ' ' + root + asset.url),
  'RUN cd ' + root + ' && echo "' + baseHtmlHash + '  index.html" | sha256sum -c -' +
    ' && sed -i \'s|</head>|' + links + '</head>|\' index.html' +
    ' && grep -Fq \'' + links + '\' index.html && nginx -t',
  ''
];
fs.writeFileSync(path.join(output, 'Dockerfile'), dockerfile.join('\n'));

if (originalIndex) {
  const original = fs.readFileSync(originalIndex, 'utf8');
  assert.equal(sha256(original), baseHtmlHash, 'Unexpected member shell');
  assert.equal(original.split('</head>').length, 2, 'Expected exactly one closing head tag');
  const preview = original.replace('</head>', links + '</head>');
  fs.writeFileSync(path.join(output, 'index.html'), preview);
  manifest.htmlHash = sha256(preview);
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
