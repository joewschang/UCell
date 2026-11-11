const fs = require('node:fs');
const path = require('node:path');
function patchReport(bundle,component) {
  const start='const bN={RECOVERY_BALANCE_MISMATCH:',end='const Hd=r=>r===null?';
  const a=bundle.indexOf(start),b=bundle.indexOf(end,a+start.length);
  if(a<0||b<a||bundle.indexOf(start,a+1)!==-1||bundle.indexOf(end,b+1)!==-1||
    !bundle.slice(a,b).includes('function IN(){')||!bundle.slice(a,b).includes('/admin/ops-ready/exports/')) {
    throw Error('Unexpected operational report release');
  }
  return bundle.slice(0,a)+component+bundle.slice(b);
}
module.exports={patchReport};
if(require.main===module){
  const target=process.argv[2],component=fs.readFileSync(path.join(__dirname,'component.js'),'utf8');
  fs.writeFileSync(target,patchReport(fs.readFileSync(target,'utf8'),component));
}
