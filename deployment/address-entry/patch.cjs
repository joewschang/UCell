'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = process.argv[2];
const index = path.join(root, 'index.html');
const html = fs.readFileSync(index, 'utf8');
const original = html.match(/src="(\/assets\/enrollment-reader-[a-f0-9]+\.js)"/)[1];
let source = fs.readFileSync(path.join(root, original), 'utf8');
function replace(before, after) {
  if (source.split(before).length !== 2) throw new Error('Unexpected form version: ' + before);
  source = source.replace(before, () => after);
}
// Parse imported full addresses only. The parent also echoes our own edits as a
// full address, which cannot distinguish a street prefix from a district name.
replace('h.useEffect(()=>{l(Qm(e))},[e])', `const lastAddress=h.useRef(e);
h.useEffect(()=>{
  if(e!==lastAddress.current){
    lastAddress.current=e;
    l(Qm(e));
  }
},[e])`);
replace('l(d),t(d.region+d.district+d.street),o==null||o(d.postalCode)',
  'lastAddress.current=d.region+d.district+d.street,l(d),t(lastAddress.current)');
// Keep manual changes made while an earlier photo is being recognized.
replace('$(ke=>({...ke,...Ye})),F(!0)', `$(current=>{
  if(B==="IDENTITY_BACK" && current.communicationAddress!==W.communicationAddress)return current;
  return {...current,...Ye};
}),F(!0)`);
const asset = '/assets/address-entry-'+createHash('sha256').update(source).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,asset),source);
fs.writeFileSync(index,html.replace(original,asset));
