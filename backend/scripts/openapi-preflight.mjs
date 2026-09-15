import fs from 'node:fs';

const candidates=[
  'openapi.generated.json',
  'apps/api/openapi.generated.json'
];
const file=candidates.find(fs.existsSync);
if(!file){
  console.error('OPENAPI_PREFLIGHT_FAIL: generated spec not found');
  process.exit(1);
}
const doc=JSON.parse(fs.readFileSync(file,'utf8'));
const failures=[];
if(!doc.openapi) failures.push('openapi version missing');
if(!doc.paths?.['/api/v1/health']) failures.push('/api/v1/health missing');
if(!Object.keys(doc.paths??{}).some(x=>x.includes('/admin/payouts'))) failures.push('payout endpoints missing');
if(!Object.keys(doc.paths??{}).some(x=>x.includes('/admin/settlement-adjustments'))) failures.push('adjustment endpoints missing');

if(failures.length){
  console.error('OPENAPI_PREFLIGHT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('OPENAPI_PREFLIGHT_PASS');
