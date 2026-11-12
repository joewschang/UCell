'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {patchApi}=require('./tracking-members.cjs');
const api='/app/apps/api/dist';
const service=path.join(api,'modules/order/admin-order-tracking.service.js');
fs.writeFileSync(service,patchApi(fs.readFileSync(service,'utf8')));
fs.copyFileSync(path.join(__dirname,'tracking-member-names.js'),path.join(api,'modules/order/tracking-member-names.js'));
const labels=[
  [path.join(api,'modules/member/formal-enrollment.controller.js'),'零售或重購訂單','零售或重銷訂單'],
  [path.join(api,'modules/epv/epv.controller.js'),'認列重購超額EPV','認列重銷超額EPV'],
  ['/app/packages/shared/dist/ai-ready/semantic.js','重購業績','重銷業績']
];
for(const [file,oldLabel,newLabel] of labels){
  const text=fs.readFileSync(file,'utf8');
  assert.equal(text.split(oldLabel).length,2,file);
  fs.writeFileSync(file,text.replace(oldLabel,newLabel));
}
assert.equal(typeof require(service).AdminOrderTrackingService,'function');
assert.equal(typeof require(path.join(api,'modules/order/tracking-member-names.js')).attachTrackingMemberNames,'function');
