import fs from 'node:fs';
const failures=[];
const files={
 app:'apps/api/src/app.module.ts',
 appCtrl:'apps/api/src/modules/application/membership-application.controller.ts',
 qualCtrl:'apps/api/src/modules/qualification/qualification.controller.ts',
 orderCtrl:'apps/api/src/modules/order/order.controller.ts',
 orgCtrl:'apps/api/src/modules/organization/organization.controller.ts',
 dashCtrl:'apps/api/src/modules/admin-dashboard/admin-dashboard.controller.ts',
};
for(const [k,p] of Object.entries(files)) if(!fs.existsSync(p)) failures.push(`${k} missing: ${p}`);
const text=p=>fs.readFileSync(p,'utf8');
if(!text(files.app).includes('AdminDashboardModule')) failures.push('AdminDashboardModule not wired');
if(!text(files.appCtrl).includes('@Get()')) failures.push('Application list endpoint missing');
if(!text(files.qualCtrl).includes('@Get()')) failures.push('Qualification list endpoint missing');
if(!text(files.orderCtrl).includes('@Get()')) failures.push('Order list endpoint missing');
if(!text(files.orgCtrl).includes("placement-preview")) failures.push('Placement preview endpoint missing');
if(!text(files.dashCtrl).includes("dashboard")) failures.push('Dashboard summary missing');
if(failures.length){console.error('ADMIN_READMODEL_PREFLIGHT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1)}
console.log('ADMIN_READMODEL_PREFLIGHT_PASS');
