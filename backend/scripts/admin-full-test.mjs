import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const database = new URL(process.env.DATABASE_URL ?? '');
assert.equal(database.pathname, '/ucell_admin_test', 'Only isolated test database allowed');
assert.ok(['localhost','127.0.0.1'].includes(database.hostname));
const prisma = new PrismaClient();
const startedAt = new Date().toISOString();
const results = [];
let failure;
let devActor;
async function provisionIsolatedEntraPrincipal(personId) {
  return prisma.$transaction(async tx => {
    const now = new Date();
    const links = await tx.identityLink.findMany({
      where: { personId, provider: 'ENTRA' },
      take: 2,
    });
    assert.ok(links.length <= 1, 'ADMIN_TEST_ACTOR_ENTRA_IDENTITY_AMBIGUOUS');
    const link = links[0] ?? await tx.identityLink.create({
      data: {
        personId,
        provider: 'ENTRA',
        providerSubject: `ADMIN_FULL_TEST_${personId}`,
      },
    });
    assert.ok(link.providerSubject.trim(), 'ADMIN_TEST_ACTOR_ENTRA_IDENTITY_INVALID');

    const grants = await tx.adminAccessGrant.findMany({
      where: {
        personId,
        provider: 'ENTRA',
        providerSubject: link.providerSubject,
        status: 'ACTIVE',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      take: 2,
    });
    assert.ok(grants.length <= 1, 'ADMIN_TEST_ACTOR_ENTRA_GRANT_AMBIGUOUS');
    const grant = grants[0] ?? await tx.adminAccessGrant.create({
      data: {
        personId,
        provider: 'ENTRA',
        providerSubject: link.providerSubject,
        roleCode: 'SUPER_ADMIN',
        status: 'ACTIVE',
        validFrom: new Date(now.getTime() - 1000),
      },
    });
    assert.equal(grant.roleCode, 'SUPER_ADMIN', 'ADMIN_TEST_ACTOR_ENTRA_ROLE_INVALID');

    const sessions = await tx.authSession.findMany({
      where: {
        personId,
        provider: 'ENTRA',
        subject: link.providerSubject,
        status: 'ACTIVE',
        revokedAt: null,
        expiresAt: { gt: now },
      },
      take: 2,
    });
    assert.ok(sessions.length <= 1, 'ADMIN_TEST_ACTOR_ENTRA_SESSION_AMBIGUOUS');
    const session = sessions[0] ?? await tx.authSession.create({
      data: {
        personId,
        provider: 'ENTRA',
        subject: link.providerSubject,
        roleCode: grant.roleCode,
        tokenHash: randomUUID(),
        status: 'ACTIVE',
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      },
    });
    assert.equal(session.roleCode, grant.roleCode, 'ADMIN_TEST_ACTOR_ENTRA_SESSION_ROLE_INVALID');
    return { personId, subject: link.providerSubject, link, grant, session };
  });
}
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
  const fixtureName='ADMIN TEST ROOT FIXTURE';
  const rootPerson=await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${fixtureName}))`;
    const people=await tx.person.findMany({where:{legalName:fixtureName},take:2});
    assert.ok(people.length<=1,'ADMIN_TEST_ROOT_FIXTURE_AMBIGUOUS');
    return people[0]??tx.person.create({data:{legalName:fixtureName,birthDate:new Date('1990-01-01')}});
  });
  let root=await prisma.qualification.findFirst({where:{currentHolderPersonId:rootPerson.personId}});
  if(!root) root=await prisma.$transaction(async tx=>{
    const at=new Date();
    const q=await tx.qualification.create({data:{currentHolderPersonId:rootPerson.personId,planLevelCode:'LEADER',status:'EFFECTIVE',activeFlag:false,effectiveAt:at}});
    await tx.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:rootPerson.personId,effectiveFrom:at,sourceType:'ADMIN_TEST_ROOT_FIXTURE'}});
    await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'LEADER',effectiveFrom:at,sourceType:'ADMIN_TEST_ROOT_FIXTURE'}});
    await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'ADMIN_TEST_ROOT_FIXTURE'}});
    return q;
  });
  // The stable isolated root existed before qualification-status history was
  // introduced. Add a prospective fixture baseline only when none is active;
  // production facts and legacy business records are never repaired here.
  await prisma.$transaction(async tx=>{
    const at=new Date();
    const statuses=await tx.qualificationStatusHistory.findMany({
      where:{qualificationId:root.qualificationId,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]},
      take:2,
    });
    assert.ok(statuses.length<=1,'ADMIN_TEST_ROOT_STATUS_HISTORY_AMBIGUOUS');
    if(!statuses.length) await tx.qualificationStatusHistory.create({
      data:{qualificationId:root.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'ADMIN_TEST_ROOT_FIXTURE'},
    });
  });
  await provisionIsolatedEntraPrincipal(rootPerson.personId);
  devActor=rootPerson.personId;
  const treeReadAt = new Date().toISOString();
  const treeList = await request('GET', `/admin/organization/trees?${new URLSearchParams({
    timezone: 'Asia/Taipei',
    periodStart: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    periodEnd: treeReadAt,
    asOf: treeReadAt,
    knowledgeCutoff: treeReadAt,
  })}`);
  assert.ok(Array.isArray(treeList.data.items));
  devActor=undefined;
  const defaultTreeList = await request('GET', `/admin/organization/trees?${new URLSearchParams({
    timezone: 'Asia/Taipei',
    periodStart: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    periodEnd: treeReadAt,
    asOf: treeReadAt,
    knowledgeCutoff: treeReadAt,
  })}`);
  assert.ok(Array.isArray(defaultTreeList.data.items));
  devActor=rootPerson.personId;
  const key=randomUUID();
  const {PersonService}=require('./apps/api/dist-admin-dev/modules/person/person.service.js');
  const {IdempotencyService}=require('./apps/api/dist-admin-dev/common/idempotency/idempotency.service.js');
  const {AuditService}=require('./apps/api/dist-admin-dev/common/audit/audit.service.js');
  const {CreatePersonDto}=require('./apps/api/dist-admin-dev/modules/person/dto/create-person.dto.js');
  const legacyKey=randomUUID(); const legacyPayload={legalName:'LEGACY SCOPE COMPATIBILITY '+legacyKey.slice(0,8)};
  const legacy=await new PersonService(prisma,new IdempotencyService(prisma),new AuditService()).create(Object.assign(new CreatePersonDto(),legacyPayload),legacyKey,randomUUID());
  const legacyReplay=await request('POST','/admin/persons',legacyPayload,legacyKey);
  assert.equal(legacyReplay.data.personId,legacy.value.personId); assert.equal(legacyReplay.meta.replayed,true);
  assert.equal(await prisma.person.count({where:{legalName:legacyPayload.legalName}}),1);
  await request('POST','/admin/persons',{legalName:'CHANGED LEGACY PAYLOAD'},legacyKey,409);
  const payload={legalName:'ADMIN TEST MEMBER '+key.slice(0,8),birthDate:'1990-01-01'};
  const person=await request('POST','/admin/persons',payload,key);
  await provisionIsolatedEntraPrincipal(person.data.personId);
  const personAudit=await prisma.auditEvent.findFirstOrThrow({where:{entityId:person.data.personId,action:'PERSON_CREATED'}});
  assert.equal(personAudit.actorId,rootPerson.personId); assert.equal(personAudit.actorType,'USER');
  const duplicate=await request('POST','/admin/persons',payload,key);
  assert.equal(duplicate.data.personId,person.data.personId); assert.equal(duplicate.meta.replayed,true);
  await request('POST','/admin/persons',{...payload,legalName:'different'},key,409);
  await request('POST','/admin/persons',payload,undefined,201);
  // Use a fresh shallow parent for the connected sale path. Reusing the leftmost
  // leaf turns repeated test runs into an ever-deeper Sponsor path, which would
  // incorrectly require a rate outside the formal STARTER schedule.
  const parent=await prisma.$transaction(async tx=>{
    const effectiveAt=new Date();
    const qualification=await tx.qualification.create({data:{
      currentHolderPersonId:rootPerson.personId,
      planLevelCode:'LEADER',
      status:'EFFECTIVE',
      activeFlag:false,
      effectiveAt,
    }});
    await tx.qualificationHolderHistory.create({data:{
      qualificationId:qualification.qualificationId,
      holderPersonId:rootPerson.personId,
      effectiveFrom:effectiveAt,
      sourceType:'ADMIN_TEST_ORDER_ROOT_FIXTURE',
    }});
    await tx.qualificationPlanHistory.create({data:{
      qualificationId:qualification.qualificationId,
      planCode:'LEADER',
      effectiveFrom:effectiveAt,
      sourceType:'ADMIN_TEST_ORDER_ROOT_FIXTURE',
    }});
    await tx.qualificationStatusHistory.create({data:{
      qualificationId:qualification.qualificationId,
      status:'EFFECTIVE',
      effectiveFrom:effectiveAt,
      sourceType:'ADMIN_TEST_ORDER_ROOT_FIXTURE',
    }});
    return qualification;
  });
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
  // The seeded legacy product deliberately has no historical parameter binding.
  // Use a prospective, test-only profile created through the authoritative Admin
  // service instead of retrofitting the legacy profile with current parameters.
  const workerProductSku='ADMIN-FULL-TEST-R1B';
  await request('POST','/admin/products',{
    sku:workerProductSku,
    displayName:'Admin full worker evidence test product',
    price:'4800.00',
    gpvRate:'0.60',
    ruleVersionCode:'R1.0B',
  });
  const products=await request('GET','/admin/products');
  const product=products.data.find(p=>p.sku===workerProductSku); assert.ok(product);
  const workerProfile=await prisma.productRuleProfile.findFirst({
    where:{productId:product.productId,effectiveTo:null},
    orderBy:{effectiveFrom:'desc'},
  });
  assert.ok(workerProfile&&workerProfile.ruleVersionCode==='R1.0B'&&/^[a-f0-9]{64}$/.test(workerProfile.parameterSnapshotHash??''),'ADMIN_TEST_PRODUCT_PROFILE_EVIDENCE_REQUIRED');
  const order=await request('POST','/admin/orders',{qualificationId:q.qualificationId,purpose:'RETAIL',items:[{productId:product.productId,quantity:'1'}]});
  const paymentKey=randomUUID();
  const payment={amount:order.data.netAmount,paymentMethod:'ADMIN_TEST_ONLY',referenceNo:randomUUID(),occurredAt:new Date().toISOString()};
  await request('POST',`/admin/orders/${order.data.orderId}/payment-confirmations`,payment,paymentKey);
  await request('POST',`/admin/orders/${order.data.orderId}/payment-confirmations`,payment,paymentKey);
  assert.equal(await prisma.paymentEvent.count({where:{orderId:order.data.orderId}}),1);
  // Connected DEV prerequisite: real worker must capture the original earning evidence before reversal.
  const deadline=Date.now()+20000;let saleReady=false;
  while(Date.now()<deadline){
    const originals=await prisma.pvLedger.findMany({where:{sourceType:'ORDER',sourceId:order.data.orderId,pvType:'GPV',eventType:'GPV_CREATED'}});
    const captured=await prisma.historicalReplaySnapshot.count({where:{kind:'GPV',sourceId:{in:originals.map(event=>event.eventId)}}});
    if(originals.length===order.data.lines.length&&captured===originals.length){saleReady=true;break;}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(saleReady,'SALE_CONFIRMED worker must capture complete historical evidence; no current-state backfill');

  const originalOrder=await request('GET',`/admin/orders/${order.data.orderId}`);
  assert.equal(originalOrder.data.lines[0].remainingReversibleQuantity,'1');
  const subscriptionBody={qualificationId:q.qualificationId,planCode:'QUARTER',startMonth:'2026-10-01'};
  const subscriptionAt=new Date('2026-10-01T00:00:00.000Z');
  const subscriptionCalendarRows=await prisma.runtimeRuleParameter.findMany({
    where:{
      ruleVersionCode:'R1.0B',
      parameterCode:{in:['subscription.calendar.timezone','subscription.calendar.period','subscription.calendar.cutoff']},
      effectiveFrom:{lte:subscriptionAt},
      OR:[{effectiveTo:null},{effectiveTo:{gt:subscriptionAt}}],
    },
  });
  const subscriptionCalendarReady=['subscription.calendar.timezone','subscription.calendar.period','subscription.calendar.cutoff']
    .every(code=>subscriptionCalendarRows.filter(row=>row.parameterCode===code&&row.scopeKey==='*').length===1);
  if(subscriptionCalendarReady){
    const subscription=await request('POST','/admin/subscriptions',subscriptionBody);
    await request('GET',`/admin/subscriptions/${subscription.data.subscriptionId}`);
    const subList=await request('GET',`/admin/subscriptions?qualificationId=${q.qualificationId}&status=ACTIVE&take=100`);
    assert.ok(subList.data.some(row=>row.subscriptionId===subscription.data.subscriptionId));
    assert.ok(subList.data.every(row=>row.qualificationId===q.qualificationId));
    await request('POST',`/admin/subscriptions/${subscription.data.subscriptionId}/cancel`,{effectiveAt:new Date().toISOString(),reasonCode:'ISOLATED TEST FUTURE MONTHS',refundAmount:'0'});
  }else{
    const blocked=await request('POST','/admin/subscriptions',subscriptionBody,undefined,422);
    assert.equal(blocked.code,'CONFIGURATION_PENDING');
  }
  await request('GET','/admin/subscriptions?status=FORGED',undefined,undefined,422);
  await request('GET','/admin/subscriptions?qualificationId=FORGED',undefined,undefined,422);
  await request('GET','/admin/subscriptions?take=NaN',undefined,undefined,422);
  const returnKey=randomUUID();
  const returnBody={reasonCode:'ADMIN_TEST_ONLY',occurredAt:new Date().toISOString(),lines:[{orderLineId:order.data.lines[0].orderLineId,quantity:'1'}]};
  const returned=await request('POST',`/admin/orders/${order.data.orderId}/returns`,returnBody,returnKey);
  const returnedAgain=await request('POST',`/admin/orders/${order.data.orderId}/returns`,returnBody,returnKey);
  assert.equal(returnedAgain.data.returnCaseId,returned.data.returnCaseId);
  const afterReturn=await request('GET',`/admin/orders/${order.data.orderId}`);
  assert.equal(afterReturn.data.lines[0].remainingReversibleQuantity,'0');
  assert.equal(afterReturn.data.lines[0].returnedQuantity,'1');
  const returnQueue=await request('GET','/admin/operations/returns?take=100');
  assert.equal(returnQueue.data.find(row=>row.returnCaseId===returned.data.returnCaseId).returnSummary.totalAmount,String(order.data.netAmount));
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
} catch(error) {failure=error?.stack??String(error);console.error(error); process.exitCode=1;}
finally {
  const out=fileURLToPath(new URL('../../governance/admin-full-test/',import.meta.url)); fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(`${out}/run-${startedAt.replaceAll(':','-')}.json`,JSON.stringify({startedAt,result:failure?'FAIL':'PASS',failure,results,
    scope:'Isolated ucell_admin_test; existing application calculates test facts; no official monetary result; not frozen five-ball golden or release/UAT signoff'},null,2)+'\n');
  await prisma.$disconnect();
}
