'use strict';
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sites = {
  admin: {
    image: '586b84d8b2794f682c8d9e28f866cbedf9e6b884e8ad8be34c6422e0a488c5dd',
    html: 'c356108e4e9ffbb3bf27c068ba20d0afbc04d7626dc5ffc0689ce702b67cffdd',
    entry: 'admin-order-labels-6dd3fef4e06905d3.js',
    entryHash: 'f04276bc1ad73eeaffa4bb4fa6f6b139f1152b6697127613b40f72e2fe4a629e',
    edits: [
      ['BINARY_LEFT_SUBTREE_REQUIRED:"第 3 位推薦球須安置於推薦球的左子樹。",', ''],
      ['," ",A.firstThirdLeftRequired&&e.jsx(ot,{tone:"warn",children:"第3位直推左子樹限制"})', ''],
      ['預檢不等於核准。Approve時Backend會在Serializable/交易流程再次配置永久Sponsor sequence、檢查Binary slot與第3位直推左子樹規則。', '核准時會重新確認推薦序號、推薦範圍與安置位置是否仍可用。']
    ]
  },
  member: {
    image: '69bd2860e003dd72b246a59e3c4ed2b99239675a69aedffcbf213893d784e9fd',
    html: 'eaa3ff774254c0f3ef1131c9cd3cbcc53b69d2550814041b8df03018e23a26c3',
    entry: 'member-order-labels-bcdbfa9ef76cd97f.js',
    entryHash: 'bcdbfa9ef76cd97f01b759733c67ba345fd57714062589a34db847c4ed6c846e',
    edits: [
      ['BINARY_LEFT_SUBTREE_REQUIRED:"第 3 位推薦球必須安置於推薦球的左子樹。請返回推薦球，從左側往下選擇。",', ''],
      ['。公司球推薦可選同一棵樹的左右空位。一般會員球推薦的第 3 位須放在推薦球左區。', '。公司球推薦可選同一棵樹的左右空位。一般會員球可在推薦球下方選擇左側或右側的可用空位。']
    ]
  }
};

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function prepare(app, root, out) {
  const site = sites[app];
  assert(site, 'Unknown site');
  const original = filename => fs.readFileSync(path.join(root, 'assets', filename), 'utf8');
  assert.equal(digest(fs.readFileSync(path.join(root, 'index.html'))), site.html, 'Unexpected base HTML');
  let code = original(site.entry);
  assert.equal(digest(code), site.entryHash, 'Unexpected base entry');
  for (const [from, to] of site.edits) {
    assert.equal(code.split(from).length, 2, 'Missing or duplicate anchor: ' + from);
    code = code.replace(from, () => to);
  }
  const tag = digest(code).slice(0, 16);
  const entry = app + '-placement-' + tag + '.js';
  const outAssets = path.join(out, 'overlay', 'assets');
  fs.mkdirSync(outAssets, {recursive:true});
  // Lazy modules import the app singleton. Update their imports and both Vite dependency lists together.
  const lazy = new Set(Array.from(code.matchAll(/["']\.\/(\w[^"'\s/]*\.js)["']/g), match => match[1]));
  const replacements = new Map([...lazy].map(name => [name, name.slice(0,-3) + '-' + tag + '.js']));
  const rewriteLinks = text => {
    for (const [from, to] of replacements) text = text.replaceAll(from, to);
    return text.replaceAll(site.entry, entry);
  };
  for (const [from, to] of replacements) fs.writeFileSync(path.join(outAssets,to), rewriteLinks(original(from)));
  code = rewriteLinks(code);
  fs.writeFileSync(path.join(outAssets,entry), code);
  const manifest = {app, entry, entryHash:digest(code), htmlHash:site.html, replacements:{['/assets/'+site.entry]:'/assets/'+entry}};
  fs.writeFileSync(path.join(out,'manifest.json'), JSON.stringify(manifest,null,2));
  fs.copyFileSync(path.join(__dirname,'../../repurchase-names/install.cjs'),path.join(out,'install.cjs'));
  fs.writeFileSync(path.join(out,'Dockerfile'), [
    'FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-' + app + '@sha256:' + site.image + ' AS base',
    'FROM node:22-alpine AS build', 'COPY --from=base /usr/share/nginx/html/ /site/',
    'COPY . /release', 'RUN node /release/install.cjs /site /release', 'FROM base',
    'COPY --from=build /site/ /usr/share/nginx/html/', 'RUN nginx -t', ''
  ].join('\n'));
  console.log(app, entry, manifest.entryHash);
}
if (require.main === module) prepare(...process.argv.slice(2));
