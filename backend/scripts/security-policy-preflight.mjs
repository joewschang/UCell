import fs from 'node:fs';
import path from 'node:path';

const failures=[];
function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())out.push(...walk(p));
    else if(e.isFile()&&p.endsWith('.controller.ts'))out.push(p);
  }
  return out;
}
const app=fs.readFileSync('apps/api/src/app.module.ts','utf8');
if((app.match(/APP_GUARD/g)||[]).length<3) failures.push('Auth + Role APP_GUARD registration incomplete');
if(!app.includes('AdminAuthenticationGuard')||!app.includes('AdminRoleGuard')) failures.push('global admin security guards missing');

for(const f of walk('apps/api/src/modules')){
  const s=fs.readFileSync(f,'utf8');
  const m=s.match(/@Controller\(['"]([^'"]+)['"]\)/);
  if(!m||!m[1].startsWith('admin/'))continue;
  if(!s.includes('@Roles('))failures.push(`${f}: admin controller has no role policy`);
}
const rg=fs.readFileSync('apps/api/src/modules/auth/admin-role.guard.ts','utf8');
if(!rg.includes('ROLE_POLICY_MISSING'))failures.push('RBAC does not fail closed on missing policy');

const ag=fs.readFileSync('apps/api/src/modules/auth/admin-authentication.guard.ts','utf8');
if(!ag.includes("env!=='production'"))failures.push('DEV auth bypass can leak to production');
if(!ag.includes("isAdminApi"))failures.push('admin API path scoping missing');
if(ag.includes("includes('/admin/')"))failures.push('auth/admin exchange may be accidentally protected');

const entra=fs.readFileSync('apps/api/src/modules/auth/entra-token-verifier.service.ts','utf8');
for(const x of ['issuer','audience','clockTolerance','tid']){
  if(!entra.includes(x))failures.push(`Entra validation missing ${x}`);
}

const auth=fs.readFileSync('apps/api/src/modules/auth/admin-auth.service.ts','utf8');
if(!auth.includes('ADMIN_ACCESS_NOT_GRANTED'))failures.push('Entra exchange not protected by explicit admin grant');
const mig=fs.readFileSync('packages/database/prisma/migrations/0016_r6_admin_access_grant/migration.sql','utf8');
if(!mig.includes('uq_admin_access_one_active_identity'))failures.push('one-active-admin-grant DB guard missing');
if(!mig.includes('ucell_guard_admin_access_grant_update'))failures.push('admin grant immutable-role DB guard missing');
if(!mig.includes('ck_admin_access_role'))failures.push('admin grant role allow-list constraint missing');
if(!auth.includes('ADMIN_SESSION_TTL_SECONDS'))failures.push('admin backend session TTL is not configurable');

if(failures.length){
  console.error('SECURITY_POLICY_PREFLIGHT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('SECURITY_POLICY_PREFLIGHT_PASS');
