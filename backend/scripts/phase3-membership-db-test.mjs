import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {MembershipApplicationService}=require('./apps/api/dist/modules/application/membership-application.service.js');
const {OrganizationService}=require('./apps/api/dist/modules/organization/organization.service.js');
const {IdempotencyService}=require('./apps/api/dist/common/idempotency/idempotency.service.js');
const {AuditService}=require('./apps/api/dist/common/audit/audit.service.js');
const {QualificationAccessService}=require('./apps/api/dist/modules/auth/qualification-access.service.js');
const {UnifiedPayableService}=require('./apps/api/dist/modules/payout/unified-payable.service.js');
const {RecoveryBalanceService}=require('./apps/api/dist/modules/payout/recovery-balance.service.js');
const {BonusLifecycleService}=require('./apps/api/dist/modules/bonus/bonus-lifecycle.service.js');
const {QualificationService}=require('./apps/api/dist/modules/qualification/qualification.service.js');
const {PersonService}=require('./apps/api/dist/modules/person/person.service.js');
const {AdminOperationsService}=require('./apps/api/dist/modules/admin-operations/admin-operations.service.js');
const url=new URL(process.env.DATABASE_URL??'');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.match(process.env.GOLDEN_ISOLATION_DATABASE??'',/^ucell_dev_golden_[a-f0-9]{32}$/);
assert.equal(url.pathname,'/'+process.env.GOLDEN_ISOLATION_DATABASE);
const db=new PrismaClient(),idempotency=new IdempotencyService(db),audit=new AuditService(),organization=new OrganizationService(db);
const service=new MembershipApplicationService(db,idempotency,audit,organization);
let assertions=0;
function equal(actual,expected,label){assert.deepEqual(actual,expected,label);assertions++;}
async function rejected(work,code){await assert.rejects(work,error=>error.getResponse?.().code===code);assertions++;}
try{
  const owner=await db.person.create({data:{legalName:'MEMBERSHIP ISOLATED TEST ONLY'}});
  const roots=[];
  for(let i=0;i<2;i++)roots.push(await db.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date('2020-01-01')}}));
  const outsider=await db.person.create({data:{legalName:'PERSON QUALIFICATION ISOLATION TEST ONLY'}});
  const outsiderBall=await db.qualification.create({data:{currentHolderPersonId:outsider.personId,planLevelCode:'STARTER',status:'DRAFT'}});
  const personReads=new PersonService(db,idempotency,audit);
  const readModels=['person','qualification','pvLedger','bonusAward','auditEvent','outboxEvent'];
  const beforeRead=await Promise.all(readModels.map(model=>db[model].count()));
  const owned=await personReads.qualifications(owner.personId);
  equal(owned.meta.total,2,'Person master-detail total counts two independent balls');
  equal(owned.data.map(row=>row.qualificationId).sort(),roots.map(row=>row.qualificationId).sort(),'Person master-detail returns all owned balls only');
  equal(owned.data.every(row=>row.currentHolderPersonId===owner.personId),true,'Person master-detail never leaks outsider holder');
  equal(owned.data.some(row=>row.qualificationId===outsiderBall.qualificationId),false,'Person master-detail excludes outsider Qualification');
  equal((await personReads.qualifications(owner.personId,1,0)).data[0].qualificationId,owned.data[0].qualificationId,'master-detail first page stable');
  equal((await personReads.qualifications(owner.personId,1,1)).data[0].qualificationId,owned.data[1].qualificationId,'master-detail second page stable');
  equal((await personReads.qualifications(owner.personId,1,2)).data,[],'master-detail exhausted page empty');
  equal((await personReads.qualifications(outsider.personId)).data[0].status,'DRAFT','current holder read includes existing DRAFT without inventing effective ownership');
  await rejected(personReads.qualifications(randomUUID()),'PERSON_NOT_FOUND');
  await rejected(personReads.qualifications('forged'),'VALIDATION_ERROR');
  await rejected(personReads.qualifications(owner.personId,101),'VALIDATION_ERROR');
  for(let i=0;i<readModels.length;i++)equal(await db[readModels[i]].count(),beforeRead[i],readModels[i]+' repeated Person detail reads have no mutation');
  const sponsor=roots[0].qualificationId,parent=roots[1].qualificationId;
  async function submitted(binaryParentQualificationId,binarySide){
    const created=await service.create({personId:owner.personId,requestedPlanLevelCode:'STARTER',sponsorQualificationId:sponsor,binaryParentQualificationId,binarySide},randomUUID(),randomUUID());
    equal(created.value.status,'DRAFT','application starts DRAFT');
    const app=created.value.applicationId;
    equal((await service.submit(app,randomUUID(),randomUUID())).value.status,'SUBMITTED','complete placement submits');
    return app;
  }
  const first=await submitted(sponsor,'LEFT');
  const approved=await service.approve(first,'approve-first',randomUUID());
  const q=approved.value.qualification.qualificationId;
  equal(approved.value.application.createdQualificationId,q,'approval links created qualification');
  equal((await db.qualification.findUniqueOrThrow({where:{qualificationId:q}})).currentHolderPersonId,owner.personId,'holder is application person');
  for(const [model,field,expected] of [['qualificationHolderHistory','holderPersonId',owner.personId],['qualificationPlanHistory','planCode','STARTER'],['qualificationStatusHistory','status','EFFECTIVE']]){
    const rows=await db[model].findMany({where:{qualificationId:q}});
    equal(rows.length,1,model+' exactly one interval');
    equal(rows[0][field],expected,model+' identity');
    equal(rows[0].effectiveFrom.getTime(),approved.value.qualification.effectiveAt.getTime(),model+' common transaction effective time');
  }
  const firstSponsor=await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:q}});
  const firstBinary=await db.binaryPlacement.findUniqueOrThrow({where:{childQualificationId:q}});
  equal(firstSponsor.sponsorQualificationId,sponsor,'first sponsor stored');
  equal(firstSponsor.sponsorSequenceNo,1,'first sponsor sequence');
  equal(firstBinary.parentQualificationId,sponsor,'first binary parent');
  equal(firstBinary.side,'LEFT','first recruit left enforced');
  const duplicate=await service.approve(first,'approve-first',randomUUID());
  equal(duplicate.replayed,true,'duplicate approval replays');
  equal(duplicate.value.qualification.qualificationId,q,'duplicate preserves qualification');
  equal(await db.qualification.count({where:{qualificationId:q}}),1,'duplicate creates no qualification');
  equal(await db.qualificationHolderHistory.count({where:{qualificationId:q}}),1,'duplicate creates no holder history');

  const second=await submitted(parent,'LEFT');
  const secondQ=(await service.approve(second,'approve-second',randomUUID())).value.qualification.qualificationId;
  equal((await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:secondQ}})).sponsorQualificationId,sponsor,'second retains sponsor A');
  equal((await db.binaryPlacement.findUniqueOrThrow({where:{childQualificationId:secondQ}})).parentQualificationId,parent,'second places under binary B');
  equal((await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:secondQ}})).sponsorSequenceNo,2,'independent binary placement retains sponsor sequence');

  const third=await submitted(sponsor,'RIGHT');
  const before=await db.qualification.count();
  await rejected(service.approve(third,'approve-third-invalid',randomUUID()),'BINARY_LEFT_SUBTREE_REQUIRED');
  equal(await db.qualification.count(),before,'invalid third creates no qualification');
  equal((await db.membershipApplication.findUniqueOrThrow({where:{applicationId:third}})).status,'SUBMITTED','invalid third does not change application');
  equal(await db.idempotencyRecord.count({where:{actorScope:'admin:membership-application:approve:'+third}}),0,'failed approval rolls back idempotency');
  equal(await db.sponsorRelationship.count({where:{sponsorQualificationId:sponsor}}),2,'failed third consumes no sequence');

  const validThird=await submitted(q,'LEFT');
  const failingAudit={write:async(tx,input)=>{await audit.write(tx,input);throw new Error('MEMBERSHIP_INJECTED_AFTER_ALL_WRITES');}};
  const failing=new MembershipApplicationService(db,idempotency,failingAudit,organization);
  const models=['qualification','qualificationHolderHistory','qualificationPlanHistory','qualificationStatusHistory','sponsorRelationship','binaryPlacement','auditEvent'];
  const counts=await Promise.all(models.map(model=>db[model].count()));
  await assert.rejects(failing.approve(validThird,'approval-retry',randomUUID()),/MEMBERSHIP_INJECTED_AFTER_ALL_WRITES/);assertions++;
  for(let i=0;i<models.length;i++)equal(await db[models[i]].count(),counts[i],models[i]+' late failure rolls back');
  equal((await db.membershipApplication.findUniqueOrThrow({where:{applicationId:validThird}})).status,'SUBMITTED','late failure restores submitted application');
  equal(await db.idempotencyRecord.count({where:{actorScope:'admin:membership-application:approve:'+validThird}}),0,'late failure rolls back key');
  const retry=(await service.approve(validThird,'approval-retry',randomUUID())).value.qualification.qualificationId;
  equal((await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:retry}})).sponsorSequenceNo,3,'retry allocates original third sequence');
  equal((await db.binaryPlacement.findUniqueOrThrow({where:{childQualificationId:retry}})).parentQualificationId,q,'third in sponsor left descendant');
  equal(await db.sponsorRelationship.count({where:{sponsorQualificationId:sponsor}}),3,'retry creates one sponsor relationship');
  // Explicit TEST_ONLY holder intervals exercise temporal authorization, not workflow fees or policy.
  const receiver=await db.person.create({data:{legalName:'TEMPORAL ACCESS TEST ONLY'}});
  const boundary=new Date(Date.now()+60000),beforeBoundary=new Date(boundary.getTime()-1);
  const holder=await db.qualificationHolderHistory.findFirstOrThrow({where:{qualificationId:q,effectiveTo:null}});
  await db.$transaction(async tx=>{
    await tx.qualificationHolderHistory.update({where:{holderHistoryId:holder.holderHistoryId},data:{effectiveTo:boundary}});
    await tx.qualificationHolderHistory.create({data:{qualificationId:q,holderPersonId:receiver.personId,effectiveFrom:boundary,sourceType:'TEST_ONLY'}});
    await tx.qualification.update({where:{qualificationId:q},data:{currentHolderPersonId:receiver.personId}});
  });
  const access=new QualificationAccessService(db);
  await access.assertHolder(owner.personId,q,beforeBoundary);assertions++;
  await assert.rejects(access.assertHolder(owner.personId,q,boundary),error=>error.getStatus?.()===403);assertions++;
  await access.assertHolder(receiver.personId,q,boundary);assertions++;
  await assert.rejects(access.assertHolder(receiver.personId,q,beforeBoundary),error=>error.getStatus?.()===403);assertions++;
  await assert.rejects(access.assertHolder(receiver.personId,secondQ,boundary),error=>error.getStatus?.()===403);assertions++;
  const version='TEST_ONLY_GROUPING',end=new Date('2020-02-01');
  const inputs=[];
  for(const [qualificationId,grossAmount] of [[sponsor,11],[parent,23],[sponsor,7]])inputs.push(await db.payableEntry.create({data:{qualificationId,grossAmount,sourceType:'TEST_ONLY',sourceId:randomUUID(),awardType:'REFERRAL',availableAt:new Date('2020-01-01'),ruleVersionCode:version}}));
  equal((await db.qualification.findUniqueOrThrow({where:{qualificationId:sponsor}})).currentHolderPersonId,owner.personId,'grouping ball A common person');
  equal((await db.qualification.findUniqueOrThrow({where:{qualificationId:parent}})).currentHolderPersonId,owner.personId,'grouping ball B common person');
  const payable=new UnifiedPayableService(db,new RecoveryBalanceService(db));
  const payout=await payable.createPayoutBatch(new Date('2020-01-01'),end,version);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:payout.payoutBatchId}});
  equal(lines.length,2,'same person has two qualification payout lines');
  for(const [qualificationId,gross,expectedEntries] of [[sponsor,'18',[inputs[0],inputs[2]]],[parent,'23',[inputs[1]]]]){
    const line=lines.find(row=>row.recipientQualificationId===qualificationId);
    equal(line.grossAmount.toString(),gross,'qualification gross remains isolated');
    equal(line.netAmount.toString(),gross,'no recovery net preserves qualification gross');
    equal([...line.detailJson.payableEntryIds].sort(),expectedEntries.map(e=>e.payableEntryId).sort(),'line contains only selected qualification entries');
    equal(await db.payableEntry.count({where:{payoutLineId:line.payoutLineId,qualificationId,status:'ALLOCATED'}}),expectedEntries.length,'allocation retains qualification');
  }
  equal(payout.totalGross.toString(),'41','batch sums qualification gross');
  equal(payout.totalNet.toString(),'41','batch sums qualification net');
  equal(await db.recoveryApplication.count({where:{payoutLine:{payoutBatchId:payout.payoutBatchId}}}),0,'no cross-qualification recovery applied');
  const lifecycleAward=await db.bonusAward.create({data:{recipientQualificationId:sponsor,awardType:'REFERRAL',theoryAmount:100,payableAmount:100,activeSnapshot:true,ruleVersionCode:'TEST_ONLY_LIFECYCLE',occurredAt:new Date('2020-01-01'),pendingUntil:end,calculationDetail:{testOnly:true}}});
  await db.bonusAwardLifecycleEvent.create({data:{bonusAwardId:lifecycleAward.bonusAwardId,status:'PENDING_45D',occurredAt:new Date('2020-01-01')}});
  const originalLifecycleAward=JSON.stringify(lifecycleAward);
  let arrived=0,release;
  const barrier=new Promise(resolve=>{release=resolve;});
  const scoped={
    bonusAward:{findMany:args=>db.bonusAward.findMany({...args,where:{...args.where,bonusAwardId:lifecycleAward.bonusAwardId}})},
    bonusAwardLifecycleEvent:{findFirst:async args=>{const row=await db.bonusAwardLifecycleEvent.findFirst(args);if(++arrived===2)release();await barrier;return row;},create:args=>db.bonusAwardLifecycleEvent.create(args)},
    $transaction:db.$transaction.bind(db)
  };
  const lifecycle=new BonusLifecycleService(scoped);
  const maturities=await Promise.all([lifecycle.matureDueAwards(end),lifecycle.matureDueAwards(end)]);
  equal(maturities.reduce((sum,row)=>sum+row.matured,0),1,'parallel maturity appends exactly one EFFECTIVE');
  equal(await db.bonusAwardLifecycleEvent.count({where:{bonusAwardId:lifecycleAward.bonusAwardId,status:'EFFECTIVE'}}),1,'one durable EFFECTIVE event');
  equal(JSON.stringify(await db.bonusAward.findUniqueOrThrow({where:{bonusAwardId:lifecycleAward.bonusAwardId}})),originalLifecycleAward,'maturity preserves original award');
  // Direct production service on a narrowed fixture facade; no monetary calculation is mocked.
  const serial=new BonusLifecycleService({...scoped,bonusAwardLifecycleEvent:db.bonusAwardLifecycleEvent});
  equal((await serial.matureDueAwards(end)).matured,0,'maturity duplicate delivery is a no-op');
  equal((await payable.materialize(end,'TEST_ONLY_LIFECYCLE')).created,1,'EFFECTIVE award materializes one payable entry');
  const paidBatch=await payable.createPayoutBatch(new Date('2020-01-01'),end,'TEST_ONLY_LIFECYCLE');
  await db.payoutBatch.update({where:{payoutBatchId:paidBatch.payoutBatchId},data:{status:'EXPORTED',exportedAt:end,exportReference:'TEST_ONLY'}});
  const operations=new AdminOperationsService(db,audit),paidAt=new Date('2020-02-02T00:00:00Z');
  await operations.markPaid(paidBatch.payoutBatchId,{paymentReference:'TEST_ONLY_BANK',paymentMethod:'TEST_ONLY',paidAt},owner.personId,'FINANCE',randomUUID(),randomUUID());
  equal(await db.bonusAwardLifecycleEvent.count({where:{bonusAwardId:lifecycleAward.bonusAwardId,status:'PAID',reasonCode:'PAYOUT_PAID'}}),1,'mark-paid appends one PAID lifecycle event');
  equal((await db.payableEntry.findUniqueOrThrow({where:{sourceType_sourceId:{sourceType:'BONUS_AWARD',sourceId:lifecycleAward.bonusAwardId}}})).status,'PAID','mark-paid advances allocated payable entry');
  equal(JSON.stringify(await db.bonusAward.findUniqueOrThrow({where:{bonusAwardId:lifecycleAward.bonusAwardId}})),originalLifecycleAward,'mark-paid preserves original award');
  const direct=new QualificationService(db,idempotency,audit,organization);
  const directRoot=await db.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date('2020-01-01')}});
  const directDto={personId:owner.personId,planLevelCode:'STARTER',sponsorQualificationId:directRoot.qualificationId,binaryParentQualificationId:directRoot.qualificationId,binarySide:'LEFT',effectiveAt:'2020-01-01T00:00:00.000Z'};
  const directCount=await db.qualification.count();
  await rejected(direct.create({...directDto,binarySide:'RIGHT'},'direct-invalid',randomUUID()),'BINARY_LEFT_SUBTREE_REQUIRED');
  equal(await db.qualification.count(),directCount,'direct invalid first RIGHT creates no qualification');
  const directFirst=await direct.create(directDto,'direct-first',randomUUID()),firstId=directFirst.value.qualification.qualificationId;
  equal(directFirst.value.sponsor.sponsorSequenceNo,1,'direct first sequence one');
  const repeated=await direct.create(directDto,'direct-first',randomUUID());
  equal(repeated.replayed,true,'direct duplicate replays');
  equal(repeated.value.qualification.qualificationId,firstId,'direct duplicate retains qualification');
  equal(await db.sponsorRelationship.count({where:{childQualificationId:firstId}}),1,'direct duplicate retains one sponsor relationship');
  const directSecond=await direct.create({...directDto,binaryParentQualificationId:firstId},'direct-second',randomUUID());
  equal(directSecond.value.sponsor.sponsorSequenceNo,2,'direct second sequence two');
  equal((await db.binaryPlacement.findUniqueOrThrow({where:{childQualificationId:directSecond.value.qualification.qualificationId}})).parentQualificationId,firstId,'direct second Binary differs from Sponsor');
  const closed=await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:directSecond.value.qualification.qualificationId}});
  await db.sponsorRelationship.update({where:{sponsorRelationshipId:closed.sponsorRelationshipId},data:{effectiveTo:new Date('2020-02-01')}}); // Explicit TEST_ONLY history, not an exit workflow.
  const directThird=await direct.create({...directDto,binaryParentQualificationId:firstId,binarySide:'RIGHT'},'direct-third',randomUUID());
  equal(directThird.value.sponsor.sponsorSequenceNo,3,'closed direct relationship does not reuse sequence');
  equal((await db.sponsorRelationship.findUniqueOrThrow({where:{childQualificationId:directSecond.value.qualification.qualificationId}})).sponsorSequenceNo,2,'closed second relationship preserves original sequence');
  console.log(`PHASE3_MEMBERSHIP_DB_PASS: ${assertions} assertions; approval, isolation, rollback/retry, temporal access, payout grouping, concurrent maturity and direct qualification`);
}finally{await db.$disconnect();}
