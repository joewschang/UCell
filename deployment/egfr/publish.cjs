'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const site = process.argv[2];
function updateEntry(htmlPath, asset, before, after) {
  const file = path.join(site, htmlPath);
  const html = fs.readFileSync(file, 'utf8');
  const src = html.match(asset)?.[1];
  if (!src) throw Error('Missing script in '+htmlPath);
  const dir = path.dirname(file);
  const original = src.startsWith('/') ? path.join(site,src) : path.join(dir,src);
  const code = fs.readFileSync(original,'utf8');
  if (code.split(before).length !== 2) throw Error('Unexpected content in '+src);
  const updated = code.replace(before,()=>after);
  const digest = createHash('sha256').update(updated).digest('hex').slice(0,14);
  const next = path.basename(original,'.js')+'-'+digest+'.js';
  fs.writeFileSync(path.join(path.dirname(original),next),updated);
  fs.writeFileSync(file,html.replace(src,()=>src.slice(0,-path.basename(original).length)+next));
}
const game = ['腎絲球過濾率計算小程式','用檢驗報告或範例換算 eGFR，讀懂數值區間，再完成腎臟觀察挑戰。','./egfr/kidney.jpg','./egfr/'];
updateEntry('health/index.html',/<script type="module" src="(\.\/hub\.js)"/,
  "'./diabetes/']","'./diabetes/'],\n    "+JSON.stringify(game));
const caption='肌少症自我檢測 · 糖尿病自我檢測';
updateEntry('index.html',/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"/,
  caption,caption+' · 腎絲球過濾率計算小程式');
