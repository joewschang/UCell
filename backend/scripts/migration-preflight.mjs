import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const dir=path.join(root,'packages/database/prisma/migrations');
const dirs=fs.readdirSync(dir).filter(x=>fs.statSync(path.join(dir,x)).isDirectory()).sort();
const failures=[];

const numeric=new Map();
for(const d of dirs){
  // Accept the repository's four-digit sequence and Prisma's fourteen-digit timestamp.
  // Compare the complete prefix so distinct timestamps in one year remain distinct.
  const m=d.match(/^(\d{4}|\d{14})_/);
  if(!m){ failures.push(`migration without numeric prefix: ${d}`); continue; }
  const n=m[1];
  const arr=numeric.get(n)??[]; arr.push(d); numeric.set(n,arr);
}
for(const [n,arr] of numeric) if(arr.length>1) failures.push(`duplicate migration prefix ${n}: ${arr.join(', ')}`);

const all=dirs.map(d=>fs.readFileSync(path.join(dir,d,'migration.sql'),'utf8')).join('\n');
if(/CREATE TABLE\s+commerce\.subscription_cancellation/i.test(all))
  failures.push('legacy commerce.subscription_cancellation must not be created');
if(!/CREATE TABLE IF NOT EXISTS\s+subscription\.subscription_cancellation/i.test(all))
  failures.push('canonical subscription.subscription_cancellation missing');
if(!/outstanding_amount/i.test(all))
  failures.push('partial recovery migration missing outstanding_amount');
if(!/settlement\.timezone/i.test(all))
  failures.push('settlement timezone parameter migration missing');

if(failures.length){
  console.error('MIGRATION_PREFLIGHT_FAIL');
  for(const f of failures) console.error('-',f);
  process.exit(1);
}
console.log('MIGRATION_PREFLIGHT_PASS');
