import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {planDuePeriodJobs,SettlementCalendarService,executePeriodClose} from '@ucell/settlement';
import {claimPeriodCloseJob,processPeriodCloseJob,sealGpvEvent} from '@ucell/database';
import {pollPeriodClosePlanner} from '../../worker/src/period-close-planner-runtime';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const kinds=['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE','PAYABLE_PREPARATION'];
(url?describe:describe.skip)('approved-calendar durable period planner',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(()=>db?.$disconnect());
 async function configuration(options:{zone?:string;anchor?:string;days?:number}={}){
  const code='TEST_PLANNER_'+randomUUID();
  for(const kind of kinds)for(const [parameterCode,valueJson] of [
   ['settlement.timezone',options.zone??'UTC'],
   ['settlement.period',{unit:'WEEK',count:1,anchorLocal:options.anchor??'1900-01-01T00:00:00'}],
   ['settlement.cut_off',{localTime:'00:00:00',daysAfterPeriodEnd:options.days??0,approvalReference:'TEST_APPROVED_CALENDAR'}],
  ] as Array<[string,Prisma.InputJsonValue]>)await db.runtimeRuleParameter.create({data:{ruleVersionCode:code,parameterCode,scopeKey:kind,valueJson,effectiveFrom:new Date('1890-01-01Z')}});
  return {ruleVersionCode:code,from:new Date('1900-01-01Z'),through:new Date('1900-01-15Z'),approvalReference:'TEST_APPROVED_PLANNER',maxPeriodsPerKind:1};
 }
 it('discovers bounded due jobs in dependency order and resumes without duplicate jobs or outbox effects',async()=>{
  const input=await configuration();
  expect(await planDuePeriodJobs(db,input)).toMatchObject({admitted:6,failures:[]});
  const first=await db.periodCloseJob.findMany({where:{ruleVersionCode:input.ruleVersionCode}});
  const binary=first.find(row=>row.kind==='BINARY_K1')!,global=first.find(row=>row.kind==='GLOBAL')!;
  expect(first.find(row=>row.kind==='MATCHING_K2')!.prerequisiteIds).toEqual([binary.periodCloseJobId]);
  expect(first.find(row=>row.kind==='WELFARE')!.prerequisiteIds).toEqual([global.periodCloseJobId]);
  expect(first.find(row=>row.kind==='PAYABLE_PREPARATION')!.prerequisiteIds).toHaveLength(5);
  expect(await planDuePeriodJobs(db,input)).toMatchObject({admitted:6,failures:[]});
  expect(await planDuePeriodJobs(db,input)).toMatchObject({admitted:0,waiting:6,failures:[]});
  const jobs=await db.periodCloseJob.findMany({where:{ruleVersionCode:input.ruleVersionCode}});
  expect(jobs).toHaveLength(12);
  expect(await db.outboxEvent.count({where:{aggregateId:{in:jobs.map(row=>row.periodCloseJobId)}}})).toBe(12);
  expect(await db.periodClosePlannerCursor.findMany({where:{ruleVersionCode:input.ruleVersionCode}})).toEqual(expect.arrayContaining(kinds.map(kind=>expect.objectContaining({kind,nextPeriodStart:input.through}))));
 });
 it('enforces approved cutoff, retaining each cursor until the horizon reaches it',async()=>{
  const input=await configuration({days:2});input.through=new Date('1900-01-09Z');
  expect(await planDuePeriodJobs(db,input)).toMatchObject({admitted:0,waiting:6,failures:[]});
  expect(await db.periodCloseJob.count({where:{ruleVersionCode:input.ruleVersionCode}})).toBe(0);
  expect(await planDuePeriodJobs(db,{...input,through:new Date('1900-01-10Z')})).toMatchObject({admitted:6,failures:[]});
 });
 it('has one job per identity under simultaneous planners and recovers a crash before cursor advancement',async()=>{
  const input=await configuration();input.through=new Date('1900-01-08Z');
  const original=db.periodClosePlannerCursor.updateMany.bind(db.periodClosePlannerCursor);
  let interrupted=false;
  const proxy=new Proxy(db,{get(target,key){
   if(key!=='periodClosePlannerCursor')return Reflect.get(target,key);
   return new Proxy(target.periodClosePlannerCursor,{get(delegate,method){return method==='updateMany'?async(args:any)=>{if(!interrupted){interrupted=true;throw new Error('SYNTHETIC_PLANNER_CRASH');}return original(args);}:Reflect.get(delegate,method);}});
  }});
  expect((await planDuePeriodJobs(proxy,input)).failures).toContainEqual({kind:'REFERRAL_K0',code:'SYNTHETIC_PLANNER_CRASH'});
  const results=await Promise.all([planDuePeriodJobs(db,input),planDuePeriodJobs(db,input)]);
  expect(results.every(row=>row.failures.length===0)).toBe(true);
  const jobs=await db.periodCloseJob.findMany({where:{ruleVersionCode:input.ruleVersionCode}});
  expect(jobs).toHaveLength(6);expect(new Set(jobs.map(row=>row.kind)).size).toBe(6);
  expect(await db.outboxEvent.count({where:{aggregateId:{in:jobs.map(row=>row.periodCloseJobId)}}})).toBe(6);
 });
 it('uses the approved timezone across daylight-saving transitions',async()=>{
  const input=await configuration({zone:'America/New_York',anchor:'2021-03-14T00:00:00'});
  input.from=new Date('2021-03-14T05:00:00Z');input.through=new Date('2021-03-21T04:00:00Z');
  expect(await planDuePeriodJobs(db,input)).toMatchObject({admitted:6,failures:[]});
  const jobs=await db.periodCloseJob.findMany({where:{ruleVersionCode:input.ruleVersionCode}});
  expect(jobs.every(row=>row.periodEnd.getTime()-row.periodStart.getTime()===167*3600000)).toBe(true);
 });
 it('fails closed on configuration changes, invalid enablement and missing calendars',async()=>{
  expect(await pollPeriodClosePlanner(db as any,{})).toEqual({enabled:false});
  await expect(pollPeriodClosePlanner(db as any,{PERIOD_CLOSE_PLANNER_ENABLED:'true'})).rejects.toThrow('PERIOD_CLOSE_PLANNER_ENABLEMENT_INVALID');
  const input=await configuration();await planDuePeriodJobs(db,input);
  const changed=await planDuePeriodJobs(db,{...input,approvalReference:'CHANGED'});
  expect(changed.failures).toHaveLength(6);expect(changed.failures.every(row=>row.code==='PERIOD_CLOSE_PLANNER_CONFIGURATION_CONFLICT')).toBe(true);
  await expect(db.periodClosePlannerCursor.updateMany({where:{ruleVersionCode:input.ruleVersionCode},data:{nextPeriodStart:input.from}})).rejects.toThrow('PERIOD_CLOSE_PLANNER_CURSOR_IMMUTABLE_CONFIGURATION');
  const missing=await planDuePeriodJobs(db,{...input,ruleVersionCode:'TEST_MISSING_'+randomUUID()});
  expect(missing.admitted).toBe(0);expect(missing.failures).toHaveLength(6);
 });
 it('keeps the Sunday week intact across the approved 10th cutoff and prepares its actual award in the 25th batch',async()=>{
  const input=await configuration({zone:'Asia/Taipei',anchor:'2020-05-03T00:00:00'});
  input.from=new Date('2020-05-09T16:00:00Z');input.through=new Date('2020-05-24T16:00:00Z');input.maxPeriodsPerKind=4;
  for(const kind of kinds)await db.runtimeRuleParameter.updateMany({where:{ruleVersionCode:input.ruleVersionCode,parameterCode:'settlement.period',scopeKey:kind},data:{valueJson:{unit:['REFERRAL_K0','PAYABLE_PREPARATION'].includes(kind)?'SETTLEMENT_10_25':['GLOBAL','WELFARE'].includes(kind)?'MONTH':'WEEK',count:1,anchorLocal:['GLOBAL','WELFARE'].includes(kind)?'2020-05-01T00:00:00':'2020-05-03T00:00:00'}}});
  for(const [parameterCode,scopeKey,valueJson] of [['award.pending.days','*','45'],['pool.referral.rate','*','0.5'],['pool.binary.rate','*','0.2'],['pool.matching.rate','*','0.2'],['binary.pair.rate','*','0.1'],['binary.weekly.cap','STARTER','10000'],['referral.g1.rate','STARTER','0.15'],['matching.rate','1','0.1']])await db.runtimeRuleParameter.create({data:{ruleVersionCode:input.ruleVersionCode,parameterCode,scopeKey,valueJson,effectiveFrom:new Date('1890-01-01Z')}});
  await db.$transaction(async tx=>{
   const person=await tx.person.create({data:{legalName:'Synthetic canonical period'}}),qualifications=[];
   const effectiveFrom=new Date('2020-05-01T00:00:00Z'),effectiveTo=new Date('2021-01-01Z');
   for(let index=0;index<3;index++){
    const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:effectiveFrom}});qualifications.push(q);
    await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom,effectiveTo,sourceType:'TEST_PLANNER'}});
    await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom,effectiveTo,sourceType:'TEST_PLANNER'}});
    await tx.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:effectiveFrom,activeTo:effectiveTo,sourceType:'TEST_PLANNER',ruleVersionCode:input.ruleVersionCode}});
    if(index)await tx.binaryPlacement.create({data:{parentQualificationId:qualifications[0].qualificationId,childQualificationId:q.qualificationId,side:index===1?'LEFT':'RIGHT',effectiveFrom,effectiveTo}});
   }
   const product=await tx.productReference.create({data:{sku:randomUUID(),displayName:'Canonical source',currentPrice:100}});
   for(const q of qualifications.slice(1)){
    const order=await tx.order.create({data:{qualificationId:q.qualificationId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:input.ruleVersionCode}});
    const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{}}});
    const event=await tx.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode:input.ruleVersionCode,occurredAt:new Date('2020-05-04Z'),correlationId:randomUUID()}});
    await sealGpvEvent(tx,event);
   }
  },{timeout:30000});
  const result=await planDuePeriodJobs(db,input);
  expect(result).toMatchObject({admitted:8,failures:[]});
  const jobs=await db.periodCloseJob.findMany({where:{ruleVersionCode:input.ruleVersionCode},orderBy:[{kind:'asc'},{periodStart:'asc'}]});
  const firstWeek=jobs.find(row=>row.kind==='BINARY_K1'&&row.periodEnd.getTime()===input.from.getTime())!;
  expect(firstWeek.periodStart.toISOString()).toBe('2020-05-02T16:00:00.000Z');
  const preparation=jobs.find(row=>row.kind==='PAYABLE_PREPARATION')!;
  expect(preparation.prerequisiteIds).toContain(firstWeek.periodCloseJobId);
  expect(preparation.prerequisiteIds).toHaveLength(7);
  for(const kind of ['REFERRAL_K0','BINARY_K1','MATCHING_K2','PAYABLE_PREPARATION'])for(const job of jobs.filter(row=>row.kind===kind))await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,executePeriodClose);
  const entries=await db.payableEntry.findMany({where:{ruleVersionCode:input.ruleVersionCode}});
  expect(entries).toHaveLength(1);expect(entries[0].grossAmount.toString()).toBe('10');
  const award=await db.bonusAward.findUniqueOrThrow({where:{bonusAwardId:entries[0].sourceId}});
  const batch=await db.settlementBatch.findUniqueOrThrow({where:{settlementBatchId:award.settlementBatchId!}});
  expect(batch.periodStart).toEqual(firstWeek.periodStart);expect(batch.periodEnd).toEqual(input.from);
  const calendar=new SettlementCalendarService(db as any);
  const parameters=await calendar.captureForPeriod(db,input.from,input.through,'PAYABLE_PREPARATION',input.ruleVersionCode);
  expect((await calendar.periodFor(db,new Date(input.from.getTime()-1),parameters,'REFERRAL_K0')).end).toEqual(input.from);
  expect((await calendar.periodFor(db,input.from,parameters,'REFERRAL_K0')).end).toEqual(input.through);
 },60000);
});
