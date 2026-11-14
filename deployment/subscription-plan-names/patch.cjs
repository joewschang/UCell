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
replace('We(R.planCode)," · ",R.durationMonths', 'subscriptionPlanName(R)," · ",R.durationMonths');
replace('We(R.plan.planCode)," · ",We(R.status)', 'subscriptionPlanName(R.plan)," · ",We(R.status)');
script += '\n' + function subscriptionPlanName(plan) {
  const name = plan.displayName?.trim();
  if (name && /[\u3400-\u9fff]/.test(name)) return name;
  return We(plan.planCode.replace(/^PO_20261019_ACTIVE_/, ''), name || plan.planCode);
}.toString();
const next = '/assets/admin-subscription-names-' + crypto.createHash('sha256').update(script).digest('hex').slice(0,16) + '.js';
fs.writeFileSync(path.join(root,next),script);
fs.writeFileSync(index,html.replace(entry,next));
