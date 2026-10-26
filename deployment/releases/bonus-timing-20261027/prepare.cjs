const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../../..'),dest='D:/UCell/review-work/bonus-timing-release';
const files={database:['bonus-timing-policy','payment-referral-snapshot','gpv-immediate-effects','historical-replay','period-close-job'],settlement:['bonus/binary-bonus.service','bonus/referral-bonus.service','global-pool/global-pool.service','period-close-planner','settlement/settlement-calendar.service'],shared:['calendar/calendar']};
const bases={api:'8dfd8bd082846de27e4b2104bfd6940780c5713804f74b95fcbeff23e59cdde2',worker:'6b84a6a5c72c3b9e335cbc67415405072a881d3cf764f4ff842416d5ee913bf8'};
for(const [app,digest] of Object.entries(bases)){
 const target=dest+'/'+app;fs.mkdirSync(target,{recursive:true});
 for(const [pkg,names] of Object.entries(files))for(const name of names){const relative=`packages/${pkg}/dist/${name}.js`,out=target+'/'+relative;fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(root+'/backend/'+relative,out);}
 fs.copyFileSync(__dirname+'/activate.cjs',target+'/activate.cjs');
 let docker=`FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:${digest}\nCOPY packages/ /app/packages/\nCOPY activate.cjs /app/bonus-timing-activate.cjs\nRUN printf '\\nObject.assign(exports, require("./bonus-timing-policy"), require("./payment-referral-snapshot"));\\n' >> /app/packages/database/dist/index.js\n`;
 if(app==='api'){
  let code=fs.readFileSync('D:/UCell/review-work/bonus-timing-live/apps/api/dist/modules/order/order.service.js','utf8');
  const needle="downstreamStatus = sponsorQualificationId ? 'PLACEMENT_PENDING' : 'BALL_SETUP_PENDING';";
  assert.equal(code.split(needle).length,2);
  code=code.replace(needle,needle+'\n                    await require("@ucell/database").capturePaymentReferral(tx, orderId, packageQualificationId, occurredAt, order.ruleVersionCode);');
  fs.writeFileSync(target+'/order.service.js',code);docker+='COPY order.service.js /app/apps/api/dist/modules/order/order.service.js\n';
 }
 fs.writeFileSync(target+'/Dockerfile',docker);
}
console.log(dest);
