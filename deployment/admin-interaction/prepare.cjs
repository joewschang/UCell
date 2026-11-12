'use strict';
const fs = require('node:fs'), path = require('node:path'), {createHash} = require('node:crypto');
const {patchPicker} = require('./picker.cjs');
const digest = data => createHash('sha256').update(data).digest('hex');
const previous = 'enrollment-review-670a073ce9e20553.js';
const inputs = {
  [previous]: '45db775217aff2dc336343c7e8fb85d1532c38883b1ba752ca9248c3816cde36',
  'DocumentIntakePage-fr8HP5K0-review-670a073ce9e20553.js': '63141cc16d4bd63c11964cb391c0a41babc253fa938cf92eda532d88c698533e',
  'jsQR-wZ-7a5RO-review-670a073ce9e20553.js': '0421c5a2b7acfa6f02ea2ac2e13def4b4c3e4a2381ef3206b98a519fa3d12cfd',
  'resignPdf-D59eW7gD-review-670a073ce9e20553.js': '3eeb4c2e67e8465d05198403c62fdc24407155184d62939c3d00ba7a1882c7dc'
};
function prepare(site, out, partial) {
  const root = path.resolve(__dirname, '../../admin/src');
  const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');
  const originals = {};
  for (const [name, sha] of Object.entries(inputs)) {
    const data = fs.readFileSync(path.join(site, 'assets', name));
    if (digest(data) !== sha) throw Error('Unrecognized production asset ' + name);
    originals[name] = data.toString('utf8');
  }
  let main = patchPicker(originals[previous]);
  const css = [read('features/qualifications/ball-picker.css')];
  if (!partial) {
    const {patchOrders} = require('./orders.cjs');
    main = patchOrders(main);
    css.push(read('features/orders/order-workspace.css'));
  }
  css.push(read('admin-interaction-states.css'));
  const styles = css.join('\n'), tag = digest(main + styles).slice(0, 16);
  const assets = path.join(out, 'assets');
  fs.mkdirSync(assets, {recursive:true});
  const entry = 'admin-workspace-' + tag + '.js', sheet = 'admin-workspace-' + digest(styles).slice(0, 16) + '.css';
  for (const [name, code] of Object.entries(originals)) {
    if (name === previous) continue;
    const next = name.replace('review-670a073ce9e20553','workspace-'+tag);
    if (!main.includes('./'+name)) throw Error('Lazy import missing for '+name);
    fs.writeFileSync(path.join(assets,next),code.replaceAll('./'+previous,'./'+entry));
    main = main.replaceAll(name,next);
  }
  fs.writeFileSync(path.join(assets,entry),main);
  fs.writeFileSync(path.join(assets,sheet),styles);
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({previous,entry,sheet,inputs}));
  for (const file of ['install.cjs','Dockerfile']) fs.copyFileSync(path.join(__dirname,file),path.join(out,file));
  console.log(JSON.stringify({entry,sheet}));
}
if(require.main===module) prepare(process.argv[2],process.argv[3],process.argv[4]==='--picker-preview');
