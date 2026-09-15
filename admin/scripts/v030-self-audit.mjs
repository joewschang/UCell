
import fs from 'node:fs';

const failures=[];
const files={
  org:'src/features/organization/OrganizationPage.tsx',
  tree:'src/components/TreeView.tsx',
  bonus:'src/features/bonuses/BonusesPage.tsx',
  qual:'src/features/qualifications/QualificationsPage.tsx',
  routes:'src/lib/routes.ts',
};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))failures.push(`${k} missing`);
const read=p=>fs.readFileSync(p,'utf8');

for(const x of ['sponsor-tree','binary-tree']){
  if(!read(files.org).includes(x))failures.push(`Organization does not use ${x}`);
}
if(!read(files.tree).includes("mode:'SPONSOR'|'BINARY'"))failures.push('Tree mode separation missing');
for(const x of ['compensation/summary','observability/settlements','observability/pools','qualifications/${qualification!.id}/operations','observability/awards']){
  if(!read(files.bonus).includes(x))failures.push(`Compensation observability missing ${x}`);
}
for(const x of ['Binary Carry','Active Timeline','Award Drill-down','K Factor','Recovery']){
  if(!read(files.bonus).includes(x))failures.push(`Compensation UX missing ${x}`);
}

// Compensation constants must not be executable in frontend logic.
// Text labels "Global 5%" and "Welfare 2%" are allowed as explanatory labels.
const feature=read(files.bonus)
  .replace(/Global 5%/g,'')
  .replace(/Welfare 2% Accrual/g,'');
for(const pat of [/\b0\.42\b/,/\b0\.36\b/,/\b0\.15\b/,/\b0\.12\b/,/\b0\.05\b/,/\b0\.02\b/]){
  if(pat.test(feature))failures.push(`compensation constant leaked to frontend logic: ${pat}`);
}
if(failures.length){
  console.error('ADMIN_V030_SELF_AUDIT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('ADMIN_V030_SELF_AUDIT_PASS');
