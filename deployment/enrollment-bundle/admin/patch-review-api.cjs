const fs=require('node:fs');
const {createHash}=require('node:crypto');

function apply(input) {
  const source=input.replace(/\r\n/g,'\n');
  const replace=(s,a,b)=>{
    if(s.split(a).length!==2)throw Error('Unexpected formal review adapter: '+a.slice(0,70));
    return s.replace(a,()=>b);
  };
  let code=replace(source,'const enrollment_bundle_payment_1 = require("./enrollment-bundle-payment");',
    'const {adminEnrollmentReview}=require("../member-bundle/admin-bundle-review");\nconst {activateEnrollmentBundleIfReady}=require("../member-bundle/excellence-activation");\nconst enrollment_bundle_payment_1 = require("./enrollment-bundle-payment");');
  code=replace(code,`if (app.applicantType === 'INDIVIDUAL' && app.personId)
                    (0, enrollment_bundle_payment_1.requirePaidBundleRoot)(await (0, enrollment_bundle_payment_1.enrollmentBundlePayment)(tx, applicationId, app.personId));`,
    `const group=app.applicantType==='INDIVIDUAL' && app.sourceChannel==='MEMBER_WEB' ? await enrollment_bundle_payment_1.enrollmentBundlePayment(tx,applicationId,app.personId) : null;
                enrollment_bundle_payment_1.requirePaidBundleRoot(group);`);
  const audit="await this.audit.write(tx, { actorType: 'ADMIN', actorId, action: 'FORMAL_APPLICATION_APPROVED'";
  code=replace(code,audit,"const activation=group?await activateEnrollmentBundleIfReady(tx,applicationId,requestId):null;\n                "+audit);
  const detail="afterData: { status: 'APPROVED', applicantType: app.applicantType, personId: app.personId, legalEntityId: app.legalEntityId }";
  code=replace(code,detail,detail.slice(0,-1)+", ...(group?{bundleId:group.bundleId,qualificationCount:group.qualificationCount,activationStatus:activation?.status}:{}) }");
  code=replace(code,'legalEntityId: app.legalEntityId, qualificationCreated: false };','legalEntityId: app.legalEntityId, qualificationCreated: false, ...(group?{bundleId:group.bundleId,approvedQualifications:group.qualificationCount,activationStatus:activation?.status}:{}) };');
  const anchor='id: application.formalMemberApplicationId, status: application.status, applicantType: application.applicantType, sourceChannel: application.sourceChannel,';
  return replace(code,anchor,anchor+'\n            enrollmentBundle:application.applicantType==="INDIVIDUAL"&&application.sourceChannel==="MEMBER_WEB"?await adminEnrollmentReview(this.db,applicationId,application.personId):null,');
}

if(require.main===module) {
  const [input,output]=process.argv.slice(2);
  const content=fs.readFileSync(input,'utf8');
  if(createHash('sha256').update(content.replace(/\r\n/g,'\n')).digest('hex')!=='bbffcec7f9ced4a699ea8fafe3517c0bc76620b153f0bb50a4dd080d55453fc3')
    throw Error('Review integration base changed');
  fs.writeFileSync(output,apply(content));
}
module.exports={apply};
