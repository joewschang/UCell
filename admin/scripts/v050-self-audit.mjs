import fs from 'node:fs';
const failures=[];
const files={
 docs:'src/features/documents/DocumentsPage.tsx',
 audit:'src/features/audit/AuditPage.tsx',
 reports:'src/features/reports/ReportsPage.tsx',
 app:'src/app/App.tsx',
 permissions:'src/features/auth/permissions.ts',
 system:'src/features/system/SystemPage.tsx'
};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))failures.push(`${k} missing`);
const read=p=>fs.readFileSync(p,'utf8');
for(const x of ['SHA-256','Supersedes','storageProvider']){
  if(!read(files.docs).includes(x))failures.push(`document integrity UX missing ${x}`);
}
for(const x of ['correlationId','beforeData','afterData']){
  if(!read(files.audit).includes(x))failures.push(`audit viewer missing ${x}`);
}
for(const x of ['integrity-alerts','Export Qualifications CSV','Integrity Alerts']){
  if(!read(files.reports).includes(x))failures.push(`reports/integrity UX missing ${x}`);
}
for(const x of ['/documents','/audit','/reports']){
  if(!read(files.app).includes(x))failures.push(`route missing ${x}`);
  if(!read(files.permissions).includes(x))failures.push(`RBAC page missing ${x}`);
}
if(failures.length){
 console.error('ADMIN_V050_SELF_AUDIT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);
}
console.log('ADMIN_V050_SELF_AUDIT_PASS');
