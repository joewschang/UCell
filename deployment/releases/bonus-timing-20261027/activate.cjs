const assert=require('node:assert/strict');
const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const {captureGlobalPeriod,capturePaymentReferral,verifyReplayEnvelope,enqueuePeriodCloseJob,BONUS_TIMING_POLICY}=require('/app/packages/database/dist');
const {BinaryBonusService}=require('/app/packages/settlement/dist/bonus/binary-bonus.service');
const {BonusQueryService}=require('/app/packages/settlement/dist/bonus/bonus-query.service');
const {SettlementCalendarService}=require('/app/packages/settlement/dist/settlement/settlement-calendar.service');
const db=new PrismaClient(),dry=process.argv.includes('--dry-run'),actor='USER_APPROVED_BONUS_TIMING_20261027';
const firstStart=new Date('2026-10-18T16:00:00Z'),firstEnd=new Date('2026-10-25T16:00:00Z');
(async()=>{try{await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT true FROM (SELECT pg_advisory_xact_lock(19670919,1027)) q`;
 await tx.$executeRawUnsafe('LOCK TABLE commerce."order", ledger.pv_ledger IN SHARE ROW EXCLUSIVE MODE');
 const existing=await tx.runtimeRuleParameter.findFirst({where:{parameterCode:'bonus.timing.policy',effectiveTo:null}});
 if(existing){assert.equal(existing.valueJson,BONUS_TIMING_POLICY);console.log('ALREADY_ACTIVE');return;}
 assert.equal(await tx.pvLedger.count({where:{pvType:'GPV',eventType:'GPV_CREATED'}}),0,'LIVE_GPV_REQUIRES_REVIEWED_TRANSITION');
 assert.equal(await tx.settlementBatch.count({where:{settlementType:{in:['BINARY_K1','MATCHING_K2']}}}),0,'BINARY_HISTORY_REQUIRES_REVIEWED_TRANSITION');
 assert.equal(await tx.globalPoolSettlement.count(),0,'GLOBAL_HISTORY_REQUIRES_REVIEWED_TRANSITION');
 const candidates=await tx.qualification.findMany({where:{kind:'MEMBER_ORIGIN',status:'EFFECTIVE'}});
 for(const q of candidates){
  const setup=await tx.qualificationSetup.findUniqueOrThrow({where:{qualificationId:q.qualificationId}});
  assert.equal(setup.setupStatus,'PLACED');assert.equal(setup.placedAt?.getTime(),q.effectiveAt?.getTime());
  const purchase=await tx.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId:setup.qualifyingOrderId}});
  assert.equal(purchase.packageCode,setup.packageType);assert.equal(purchase.packageCode,q.planLevelCode);
  const placement=await tx.placementEvidence.findFirstOrThrow({where:{qualificationId:q.qualificationId,placedAt:setup.placedAt}});
  const history=await tx.qualificationStatusHistory.findMany({where:{qualificationId:q.qualificationId}});
  assert(history.some(h=>h.status==='EFFECTIVE'&&h.sourceId===placement.placementEvidenceId&&h.effectiveFrom.getTime()===q.effectiveAt.getTime()));
  const plans=await tx.qualificationPlanHistory.findMany({where:{qualificationId:q.qualificationId}});
  if(!plans.length)await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:purchase.packageCode,effectiveFrom:setup.placedAt,sourceType:'QUALIFICATION_PLACEMENT',sourceId:placement.placementEvidenceId}});
  const overlaps=history.filter(h=>h.status==='DRAFT'&&!h.effectiveTo&&h.effectiveFrom<setup.placedAt);
  for(const h of overlaps)await tx.qualificationStatusHistory.update({where:{qualificationStatusHistoryId:h.qualificationStatusHistoryId},data:{effectiveTo:setup.placedAt}});
  if(!plans.length||overlaps.length)await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'PLACEMENT_HISTORY_REPAIRED',entityType:'QUALIFICATION',entityId:q.qualificationId,requestId:actor,correlationId:require('crypto').randomUUID(),afterData:JSON.parse(JSON.stringify({placementEvidenceId:placement.placementEvidenceId,packageCode:purchase.packageCode,placedAt:setup.placedAt,previousPlans:plans,previousStatus:history}))}});
 }
 const beforeParameters=await tx.runtimeRuleParameter.findMany({where:{parameterCode:'settlement.period',scopeKey:{in:['BINARY_K1','MATCHING_K2']},effectiveTo:null}});
 assert.equal(beforeParameters.length,2);
 const jobs=await tx.periodCloseJob.findMany({where:{kind:{in:['BINARY_K1','MATCHING_K2']}},include:{receipt:true,outbox:true}});
 assert(jobs.every(j=>!j.receipt&&['PENDING','DEAD'].includes(j.outbox.processStatus)),'JOB_IN_FLIGHT');
 const cursors=await tx.periodClosePlannerCursor.findMany({where:{kind:{in:['BINARY_K1','MATCHING_K2']}}});
 const activationAt=new Date();
 await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'BONUS_TIMING_BEFORE',entityType:'RULE_POLICY',requestId:actor,correlationId:require('crypto').randomUUID(),afterData:JSON.parse(JSON.stringify({approvalReference:actor,beforeParameters,jobs,cursors,activationAt}))}});
 for(const row of beforeParameters){
  assert(row.effectiveFrom<firstStart,'CALENDAR_HISTORY_CONFLICT');
  await tx.runtimeRuleParameter.update({where:{runtimeRuleParameterId:row.runtimeRuleParameterId},data:{effectiveTo:firstStart}});
  await tx.runtimeRuleParameter.create({data:{ruleVersionCode:'R1.0B',parameterCode:row.parameterCode,scopeKey:row.scopeKey,valueJson:{unit:'WEEK',count:1,anchorLocal:'2026-10-19T00:00:00'},effectiveFrom:firstStart}});
 }
 for(const [parameterCode,valueJson] of [['bonus.timing.policy',BONUS_TIMING_POLICY],['global.weekly.firstClose',firstEnd.toISOString()]])await tx.runtimeRuleParameter.create({data:{ruleVersionCode:'R1.0B',parameterCode,scopeKey:'*',valueJson,effectiveFrom:parameterCode==='global.weekly.firstClose'?firstStart:activationAt}});
 for(const job of jobs)await tx.outboxEvent.update({where:{outboxEventId:job.outboxEventId},data:{processStatus:'DEAD',lastError:'SUPERSEDED_BY_'+actor}});
 const client=new Proxy(tx,{get:(t,k)=>k==='$transaction'?fn=>fn(tx):t[k]});
 const calendar=new SettlementCalendarService(client);
 const request={periodStart:firstStart,periodEnd:firstEnd,ruleVersionCode:'R1.0B',requestedBy:actor,approvalReference:actor};
 const binaryJob=await enqueuePeriodCloseJob(client,{...request,kind:'BINARY_K1',prerequisiteIds:[]},t=>calendar.captureForPeriod(t,firstStart,firstEnd,'BINARY_K1','R1.0B'));
 await enqueuePeriodCloseJob(client,{...request,kind:'MATCHING_K2',prerequisiteIds:[binaryJob.periodCloseJobId]},t=>calendar.captureForPeriod(t,firstStart,firstEnd,'MATCHING_K2','R1.0B'));
 // Never rewind the immutable planner cursor. Explicitly admit the transition week.
 await tx.periodClosePlannerCursor.updateMany({where:{kind:{in:['BINARY_K1','MATCHING_K2']}},data:{nextPeriodStart:firstEnd}});
 if(dry){
  const query=new BonusQueryService(client),binary=new BinaryBonusService(client,{},query,calendar);
  const b=await binary.settleBinary(firstStart,firstEnd),m=await binary.settleMatching(firstStart,firstEnd);
  assert.equal(b.status,'FINALIZED');assert.equal(m.status,'FINALIZED');
  for(const batch of [b,m])verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:batch.settlementType,sourceId:batch.settlementBatchId}}}));
  const global=await captureGlobalPeriod(tx,new Date('2026-09-30T16:00:00Z'),new Date('2026-10-31T16:00:00Z'),'R1.0B');
  assert.equal(global.weeks.length,1);assert(global.total.eq(0));
  const sponsor=await tx.sponsorRelationship.findFirst({where:{effectiveTo:null,child:{kind:'COMPANY_BOOTSTRAP'}}});
  assert(sponsor,'PAYMENT_TEST_SPONSOR_REQUIRED');
  const orderId=require('crypto').randomUUID();
  await capturePaymentReferral(tx,orderId,sponsor.childQualificationId,new Date(),'R1.0B');
  const payment=verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'PAYMENT_REFERRAL',sourceId:orderId}}}));
  assert.equal(payment.inputs.qualificationId,sponsor.childQualificationId);
  console.log('BINARY_MATCHING_GLOBAL_PAYMENT_SNAPSHOT_VALIDATED');
  throw Error('ROLLBACK_VALIDATION_SUCCESS');
 }
 console.log(JSON.stringify({status:'ACTIVATED',activationAt,firstWeek:{start:firstStart,end:firstEnd},supersededJobs:jobs.length}));
 },{timeout:120000,isolationLevel:'Serializable'});}catch(e){if(dry&&e.message==='ROLLBACK_VALIDATION_SUCCESS')console.log('ROLLED_BACK_VALIDATION');else throw e;}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
