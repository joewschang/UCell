const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = process.argv[2];
const index = path.join(root, 'index.html');
const html = fs.readFileSync(index, 'utf8');
const entry = html.match(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"/)[1];
const bundle = fs.readFileSync(path.join(root, entry), 'utf8');
const oldMode = '[l,c]=h.useState(a?"reset":new URLSearchParams(window.location.search).get("mode")==="register"?"register":"login")';
const newMode = oldMode.replace('h.useState(a?', 'h.useState(n?"register":a?');
if (bundle.split(oldMode).length !== 2 || !bundle.includes('lineRegistrationToken:n,onExistingMemberBinding:i}')) {
  throw Error('Unexpected registration component');
}
const updated = bundle.replace(oldMode, newMode);
const key = createHash('sha256').update(updated).digest('hex').slice(0,16);
const asset = '/assets/member-line-entry-' + key + '.js';
fs.writeFileSync(path.join(root, asset), updated);
fs.writeFileSync(index, html.replace(entry, asset));
