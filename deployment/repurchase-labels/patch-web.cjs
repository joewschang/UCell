const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.argv[2];
const htmlFile = path.join(root, 'index.html');
const html = fs.readFileSync(htmlFile, 'utf8');
const entry = html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
const label = 'YEAR:"年度方案",MONTH:"月度方案"';
const updated = 'QUARTER:"重銷（三個月）",HALF_YEAR:"重銷（六個月）",YEAR:"重銷（十二個月）",MONTH:"月度方案"';
for (const name of fs.readdirSync(root,{ recursive:true })) {
  if (!name.endsWith('.js')) continue;
  const file = path.join(root,name);
  const before = fs.readFileSync(file,'utf8');
  if (!before.includes(label)) continue;
  const after = before.replaceAll(label,updated);
  fs.writeFileSync(file,after);
}
const bytes = fs.readFileSync(path.join(root,entry));
if (!bytes.includes(updated)) throw Error('Entry bundle does not contain the new plan names');
const releaseName = '/assets/repurchase-' + crypto.createHash('sha256').update(bytes).digest('hex').slice(0,14) + '.js';
fs.writeFileSync(path.join(root,releaseName),bytes);
fs.writeFileSync(htmlFile,html.replace(entry,releaseName));
