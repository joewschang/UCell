
import fs from 'node:fs';
import path from 'node:path';
const failures=[];
const files={
 api:'src/lib/api.ts',
 person:'src/features/people/PeoplePage.tsx',
 wizard:'src/features/applications/NewApplicationWizard.tsx',
 apps:'src/features/applications/ApplicationsPage.tsx',
 quals:'src/features/qualifications/QualificationsPage.tsx',
 products:'src/features/products/ProductsPage.tsx',
 orders:'src/features/orders/OrdersPage.tsx',
 dashboard:'src/features/dashboard/DashboardPage.tsx',
};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))failures.push(`${k} missing`);
const read=p=>fs.readFileSync(p,'utf8');

if(!read(files.api).includes("Idempotency-Key")) failures.push('Idempotency-Key support missing');
if(!read(files.person).includes("legalName")) failures.push('Person form not aligned to CreatePersonDto.legalName');
if(read(files.person).includes("displayName")) failures.push('Legacy Person.displayName field remains');
if(!read(files.wizard).includes("requestedPlanLevelCode")) failures.push('Application DTO requestedPlanLevelCode missing');
if(!read(files.wizard).includes("binaryParentQualificationId")) failures.push('Application Binary Parent missing');
if(!read(files.wizard).includes("placement-preview")) failures.push('Placement preview missing');
if(!read(files.apps).includes("membership-applications")) failures.push('Application queue not wired');
if(!read(files.quals).includes("admin/qualifications")) failures.push('Qualification list not wired');
if(!read(files.products).includes("displayName") || !read(files.products).includes("price")) failures.push('Product DTO mismatch');
if(!read(files.orders).includes("payment-confirmations")) failures.push('Payment confirmation missing');
if(!read(files.orders).includes("查看Qualification／PV Ledger")) failures.push('Payment completion link to Qualification/PV missing');
if(!read(files.orders).includes("items:lines.map")) failures.push('Order items DTO mapping missing');
if(!read(files.dashboard).includes("admin/dashboard/summary")) failures.push('Dashboard read model missing');

const source=fs.readdirSync('src/features',{withFileTypes:true})
  .filter(e=>e.isDirectory())
  .flatMap(e=>{
    const d=path.join('src/features',e.name);
    return fs.readdirSync(d).filter(x=>x.endsWith('.tsx')).map(x=>fs.readFileSync(path.join(d,x),'utf8'));
  }).join('\n');

// No executable compensation constants in frontend features.
for(const pat of [/\b0\.42\b/,/\b0\.36\b/,/\b0\.15\b/,/\b0\.12\b/]){
  if(pat.test(source)) failures.push(`compensation constant leaked to frontend: ${pat}`);
}

if(failures.length){
 console.error('ADMIN_V020_SELF_AUDIT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);
}
console.log('ADMIN_V020_SELF_AUDIT_PASS');
