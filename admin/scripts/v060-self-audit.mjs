import fs from 'node:fs';
const failures=[];
const files={
 api:'src/lib/api.ts',auth:'src/features/auth/auth.tsx',entra:'src/features/auth/entra.ts',
 login:'src/features/auth/LoginPage.tsx',uat:'src/features/uat/UatPage.tsx',
 scenarios:'src/features/uat/uat-scenarios.ts',permissions:'src/features/auth/permissions.ts',
};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))failures.push(`${k} missing`);
const read=p=>fs.readFileSync(p,'utf8');

if(read(files.api).includes("localStorage.getItem('ucell_admin_token')"))failures.push('admin bearer still stored in localStorage');
if(!read(files.api).includes("sessionStorage.getItem('ucell_admin_token')"))failures.push('session-scoped bearer missing');
if(!read(files.api).includes('ucell:admin-unauthorized'))failures.push('401 session invalidation missing');

for(const x of ['PublicClientApplication','loginPopup','openid','profile']){
  if(!read(files.entra).includes(x))failures.push(`MSAL integration missing ${x}`);
}
for(const x of ['entra/exchange','auth/admin/me','auth/admin/logout']){
  if(!read(files.auth).includes(x))failures.push(`backend auth flow missing ${x}`);
}
if(!read(files.auth).includes("import.meta.env.PROD"))failures.push('production demo-login guard missing');
if(!read(files.uat).includes('Evidence')||!read(files.uat).includes('PASS'))failures.push('UAT evidence workflow missing');
if(!read(files.scenarios).includes('UAT-R6-030'))failures.push('R6 UAT matrix incomplete');
if(!read(files.permissions).includes("'/uat'"))failures.push('UAT route permission missing');

if(failures.length){
 console.error('ADMIN_V060_SELF_AUDIT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);
}
console.log('ADMIN_V060_SELF_AUDIT_PASS');
