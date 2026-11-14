const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.argv[2];
const index = path.join(root, 'index.html');
const html = fs.readFileSync(index, 'utf8');
const entry = html.match(/type="module" crossorigin src="([^"]+)"/)[1];
let script = fs.readFileSync(path.join(root,entry), 'utf8');
function replace(before, after) {
  if (script.split(before).length !== 2) throw Error('Unexpected subscription page: ' + before);
  script = script.replace(before, () => after);
}
replace('ucDateMap((((S=c.data)==null?void 0:S.data)??[]),R=>e.jsxs("p",{children:[subscriptionPlanName(R)', 'ucDateMap(overviewPlans((((S=c.data)==null?void 0:S.data)??[])),R=>e.jsxs("p",{children:[subscriptionPlanName(R)');
script += '\n' + function overviewPlans(plans) {
 const seen = new Set();
 return plans.filter(plan => {
   const family = plan.planCode.replace(/^PO_20261019_ACTIVE_(QUARTER|HALF_YEAR|YEAR)$/, '$1');
   const key = JSON.stringify([family, subscriptionPlanName(plan), plan.durationMonths,
     Number(plan.monthlyRecognizedAmount), Number(plan.monthlyRpv)]);
   if (seen.has(key)) return false;
   seen.add(key);
   return true;
 });
}.toString();
const next = '/assets/admin-plan-overview-' + crypto.createHash('sha256').update(script).digest('hex').slice(0,16) + '.js';
fs.writeFileSync(path.join(root,next),script);
fs.writeFileSync(index,html.replace(entry,next));
