import fs from 'node:fs';
import path from 'node:path';
const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const dir='packages/database/prisma/migrations';
const sql=fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort()
  .map(d=>fs.readFileSync(path.join(dir,d,'migration.sql'),'utf8')).join('\n');
const failures=[];
function vals(name){
  const m=schema.match(new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if(!m){failures.push(`missing enum ${name}`);return [];}
  return m[1].split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('@@')&&!x.startsWith('//')).map(x=>x.split(/\s+/)[0]);
}
const award=vals('BonusAwardType');
for(const x of ['REFERRAL','EQUALIZATION','BINARY','MATCHING','RPV','GLOBAL'])
  if(!award.includes(x)) failures.push(`BonusAwardType missing ${x}`);
const idp=vals('IdentityProvider');
for(const x of ['ADMIN_LOCAL','ENTRA','LINE']) if(!idp.includes(x)) failures.push(`IdentityProvider missing ${x}`);
if(!/RPV/.test(sql)) failures.push('migration history lacks RPV');
if(!/GLOBAL/.test(sql)) failures.push('migration history lacks GLOBAL');
if(failures.length){console.error('ENUM_MIGRATION_PREFLIGHT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);}
console.log('ENUM_MIGRATION_PREFLIGHT_PASS');
