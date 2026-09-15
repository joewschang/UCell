import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const database = new URL(process.env.DATABASE_URL ?? '');
assert.equal(database.pathname, '/ucell_admin_test', 'Only isolated test database allowed');
assert.ok(['localhost','127.0.0.1'].includes(database.hostname));
const prisma = new PrismaClient();
const startedAt = new Date().toISOString();
const results = [];
let devActor;
async function request(method, route, body, key=randomUUID(), expected=method==='POST'?201:200) {
  const response = await fetch('http://127.0.0.1:3001/api/v1'+route, {method,
    headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(devActor?{'x-ucell-dev-actor-id':devActor}:{}),'Idempotency-Key':key,'x-request-id':randomUUID()},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const json = await response.json();
  results.push({method,route,status:response.status,expected,result:response.status===expected?'PASS':'FAIL',
    ...(response.status===expected?{}:{error:json})});
  assert.equal(response.status,expected,`${method} ${route}: ${JSON.stringify(json)}`);
  return json;
}
try {
  // Non-monetary test prerequisite, not the formal five-ball golden dataset.
  let rootPerson=await prisma.person.findFirst({where:{legalName:'ADMIN TEST ROOT FIXTURE'}});
  if(!rootPerson) rootPerson=await prisma.person.create({data:{legalName:'ADMIN TEST ROOT FIXTURE',birthDate:new Date('1990-01-01')}});
  let root=await prisma.qualification.findFirst({where:{currentHolderPersonId:rootPerson.personId}});
  if(!root) root=await prisma.$transaction(async tx=>{
    const at=new Date('2026-09-01T00:00:00Z');
    const q=await tx.qualification.create({data:{currentHolderPersonId:rootPerson.personId,planLevelCode:'LEADER',status:'EFFECTIVE',activeFlag:false,effectiveAt:at}});
    await tx.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:rootPerson.personId,effectiveFrom:at,sourceType:'ADMIN_TEST_ROOT_FIXTURE'}});
    await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'LEADER',effectiveFrom:at,sourceType:'ADMIN_TEST_ROOT_FIXTURE'}});
    return q;
  });
  const key=randomUUID();
  const payload={legalName:'ADMIN TEST MEMBER '+key.slice(0,8),birthDate:'1990-01-01'};
  const person=await request('POST','/admin/persons',payload,key);
  const personAudit=await prisma.auditEvent.findFirstOrThrow({where:{entityId:person.data.personId,action:'PERSON_CREATED'}});
  assert.equal(personAudit.actorId,rootPerson.personId); assert.equal(personAudit.actorType,'USER');
  const duplicate=await request('POST','/admin/persons',payload,key);
  assert.equal(duplicate.data.personId,person.data.personId); assert.equal(duplicate.meta.replayed,true);
  await request('POST','/admin/persons',{...payload,legalName:'different'},key,409);
  await request('POST','/admin/persons',payload,undefined,201);
  let parent=root;
  for(;;){const edge=await prisma.binaryPlacement.findFirst({where:{parentQualificationId:parent.qualificationId,side:'LEFT',effectiveTo:null}});
    if(!edge)break; parent=await prisma.qualification.findUniqueOrThrow({where:{qualificationId:edge.childQualificationId}});}
  const placement=await request('GET',`/admin/organization/placement-preview?sponsorQualificationId=${parent.qualificationId}&binaryParentQualificationId=${parent.qualificationId}&binarySide=LEFT`);
  assert.equal(placement.data.valid,true);
  const app=await request('POST','/admin/membership-applications',{personId:person.data.personId,requestedPlanLevelCode:'STARTER',sponsorQualificationId:parent.qualificationId,binaryParentQualificationId:parent.qualificationId,binarySide:'LEFT'});
  await request('POST',`/admin/membership-applications/${app.data.applicationId}/submit`);
  const approveKey=randomUUID();
  const approved=await request('POST',`/admin/membership-applications/${app.data.applicationId}/approve`,undefined,approveKey);
  const approvedAgain=await request('POST',`/admin/membership-applications/${app.data.applicationId}/approve`,undefined,approveKey);
  assert.equal(approvedAgain.meta.replayed,true);
  const q=await prisma.qualification.findFirstOrThrow({where:{currentHolderPersonId:person.data.personId}});
  assert.equal(q.status,'EFFECTIVE');
  await request('GET',`/admin/qualifications/${q.qualificationId}`);
  await request('GET',`/admin/observability/organization/sponsor-tree/${root.qualificationId}`);
  await request('GET',`/admin/observability/organization/binary-tree/${root.qualificationId}`);
  const products=await request('GET','/admin/products');
  const product=products.data.find(p=>p.sku==='UCELL-MAIN-4800'); assert.ok(product);
  const order=await request('POST','/admin/orders',{qualificationId:q.qualificationId,purpose:'RETAIL',items:[{productId:product.productId,quantity:'1'}]});
  const paymentKey=randomUUID();
  const payment={amount:order.data.netAmount,paymentMethod:'ADMIN_TEST_ONLY',referenceNo:randomUUID(),occurredAt:new Date().toISOString()};
  await request('POST',`/admin/orders/${order.data.orderId}/payment-confirmations`,payment,paymentKey);
  await request('POST',`/admin/orders/${order.data.orderId}/payment-confirmations`,payment,paymentKey);
  assert.equal(await prisma.paymentEvent.count({where:{orderId:order.data.orderId}}),1);
  await request('GET',`/admin/orders/${order.data.orderId}`);
  const subscription=await request('POST','/admin/subscriptions',{qualificationId:q.qualificationId,planCode:'QUARTER',startMonth:'2026-10-01'});
  await request('GET',`/admin/subscriptions/${subscription.data.subscriptionId}`);
  await request('POST',`/admin/subscriptions/${subscription.data.subscriptionId}/cancel`,{effectiveAt:new Date().toISOString(),reasonCode:'ISOLATED TEST FUTURE MONTHS',refundAmount:'0'});
  const returnKey=randomUUID();
  const returnBody={reasonCode:'ADMIN_TEST_ONLY',occurredAt:new Date().toISOString(),lines:[{orderLineId:order.data.lines[0].orderLineId,quantity:'1'}]};
  const returned=await request('POST',`/admin/orders/${order.data.orderId}/returns`,returnBody,returnKey);
  const returnedAgain=await request('POST',`/admin/orders/${order.data.orderId}/returns`,returnBody,returnKey);
  assert.equal(returnedAgain.data.returnCaseId,returned.data.returnCaseId);
  await request('POST',`/admin/orders/${order.data.orderId}/returns/${returned.data.returnCaseId}/process-reversal`);
  await request('GET',`/admin/operations/returns/${returned.data.returnCaseId}`);
  const workflow=await request('POST','/admin/qualification-workflows',{qualificationId:q.qualificationId,workflowType:'UPGRADE',targetPlanCode:'ELITE'});
  await request('POST',`/admin/qualification-workflows/${workflow.data.qualificationWorkflowId}/approve`,{},undefined,422);
  const attachment=await request('POST','/admin/ops-ready/attachments',{entityType:'PERSON',entityId:person.data.personId,documentType:'ADMIN_TEST_ONLY',originalFileName:'test-empty.txt',mimeType:'text/plain',sizeBytes:'0',sha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',storageProvider:'LOCAL_TEST_METADATA_ONLY',objectKey:'admin-test/'+key});
  const attachments=await request('GET',`/admin/ops-ready/attachments?entityType=PERSON&entityId=${person.data.personId}`);
  assert.ok(attachments.data.some(row=>row.documentAttachmentId===attachment.data.documentAttachmentId));
  await request('POST','/admin/payouts/materialize',{cutoff:new Date().toISOString()});
  await request('POST','/admin/payouts/materialize',{cutoff:'invalid'},undefined,400);
  await request('POST','/admin/payouts/batches',{periodStart:'2026-09-01',periodEnd:'2026-09-01'},undefined,400);
  const batch=await request('POST','/admin/payouts/batches',{periodStart:'2026-09-01T00:00:00Z',periodEnd:new Date().toISOString()});
  await request('GET',`/admin/operations/payout-batches/${batch.data.payoutBatchId}`);
  await request('POST',`/admin/operations/payout-batches/${batch.data.payoutBatchId}/approvals/FINANCE_REVIEW`,{note:'ISOLATED ADMIN TEST'});
  await request('POST',`/admin/operations/payout-batches/${batch.data.payoutBatchId}/approvals/COMPLIANCE_REVIEW`,{note:'SAME ACTOR MUST BE REJECTED'},undefined,422);
  devActor=person.data.personId;
  await request('POST',`/admin/operations/payout-batches/${batch.data.payoutBatchId}/approvals/COMPLIANCE_REVIEW`,{note:'ISOLATED SECOND ACTOR'});
  await request('POST',`/admin/operations/payout-batches/${batch.data.payoutBatchId}/export`,{exportReference:'ISOLATED TEST NO BANK EXPORT'});
  await request('POST',`/admin/operations/payout-batches/${batch.data.payoutBatchId}/mark-paid`,{paymentReference:'ISOLATED TEST NO TRANSFER',paymentMethod:'TEST_ONLY',paidAt:new Date().toISOString()});
  devActor=undefined;
  devActor=randomUUID(); await request('GET','/admin/persons',undefined,undefined,401); devActor=undefined;
  await request('GET','/admin/ops-ready/exports/ORDERS');
  await request('GET','/admin/ops-ready/integrity-alerts');
  console.log(`ADMIN_FULL_TEST_PASS: ${results.length} requests; fixture root ${root.qualificationId}`);
} catch(error) {console.error(error); process.exitCode=1;}
finally {
  const out='../governance/admin-full-test'; fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(`${out}/run-${startedAt.replaceAll(':','-')}.json`,JSON.stringify({startedAt,results,
    scope:'Isolated ucell_admin_test; existing application calculates test facts; no official monetary result; not frozen five-ball golden or release/UAT signoff'},null,2)+'\n');
  await prisma.$disconnect();
}
