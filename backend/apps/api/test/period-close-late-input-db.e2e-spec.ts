import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {enqueuePeriodCloseJob,claimPeriodCloseJob,processPeriodCloseJob,sealGpvEvent} from '@ucell/database';
import {SettlementCalendarService,executePeriodClose} from '@ucell/settlement';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const start=new Date('1900-01-01Z'),end=new Date('1900-01-08Z');
function gate(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};}
(url?describe:describe.skip)('closed-period original input boundary',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(()=>db.$disconnect());
 async function waitForBlockedVolumeLock(){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){
   const [row]=await db.$queryRaw<Array<{waiting:boolean}>>`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE relation='ledger.pv_ledger'::regclass AND NOT granted) AS waiting`;
   if(row.waiting)return;
   await new Promise(r=>setTimeout(r,25));
  }
  throw new Error('EXPECTED_DATABASE_LOCK_WAIT');
 }
 async function fixture(){
  const ruleVersionCode='TEST_LATE_'+randomUUID();
  for(const [parameterCode,scopeKey,valueJson] of [
   ['award.pending.days','*','45'],['pool.referral.rate','*','0.5'],['referral.g1.rate','STARTER','0.15'],
   ['settlement.timezone','REFERRAL_K0','UTC'],
   ['settlement.period','REFERRAL_K0',{unit:'WEEK',count:1,anchorLocal:'1900-01-01T00:00:00'}],
   ['settlement.cut_off','REFERRAL_K0',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_CALENDAR'}],
  ] as Array<[string,string,Prisma.InputJsonValue]>)await db.runtimeRuleParameter.create({data:{ruleVersionCode,parameterCode,scopeKey,valueJson,effectiveFrom:new Date('1890-01-01Z')}});
  const person=await db.person.create({data:{legalName:'Synthetic late input'}});
  const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:start}});
  await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:start,sourceType:'TEST_LATE'}});
  await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:start,sourceType:'TEST_LATE'}});
  await db.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:start,activeTo:end,sourceType:'TEST_LATE',ruleVersionCode}});
  const product=await db.productReference.create({data:{sku:randomUUID(),displayName:'Synthetic late source',currentPrice:100}});
  const order=await db.order.create({data:{qualificationId:q.qualificationId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode}});
  const line=await db.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{}}});
  const data={qualificationId:q.qualificationId,pvType:'GPV' as const,amount:100,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode,occurredAt:new Date('1900-01-02Z'),correlationId:randomUUID()};
  const job=await enqueuePeriodCloseJob(db,{kind:'REFERRAL_K0',periodStart:start,periodEnd:end,ruleVersionCode,prerequisiteIds:[],requestedBy:'TEST',approvalReference:'TEST_APPROVAL'},tx=>new SettlementCalendarService(db as any).captureForPeriod(tx,start,end,'REFERRAL_K0',ruleVersionCode));
  const lease=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
  return {data,job,lease};
 }
 async function insert(tx:Prisma.TransactionClient,data:Prisma.PvLedgerUncheckedCreateInput){const event=await tx.pvLedger.create({data});await sealGpvEvent(tx,event);return event;}
 it('rejects late originals, retains half-open/rule boundaries and permits exact redelivery plus linked correction',async()=>{
  const {data,job,lease}=await fixture();
  const original=await db.$transaction(tx=>insert(tx,data));
  await processPeriodCloseJob(db,lease,executePeriodClose);
  const receipt=await db.periodCloseReceipt.findUniqueOrThrow({where:{periodCloseJobId:job.periodCloseJobId}});
  const snapshot=await db.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:receipt.snapshotId}});
  for(const pvType of ['GPV','RPV','EPV'] as const)await expect(db.pvLedger.create({data:{...data,pvType,sourceId:randomUUID()}})).rejects.toThrow('PERIOD_CLOSE_LATE_INPUT_REQUIRES_CORRECTION');
  await expect(db.pvLedger.create({data:{...data,amount:101}})).rejects.toThrow('PERIOD_CLOSE_LATE_INPUT_REQUIRES_CORRECTION');
  await expect(db.pvLedger.create({data:{...data,sourceLineId:null}})).rejects.toThrow('PERIOD_CLOSE_LATE_INPUT_REQUIRES_CORRECTION');
  expect((await db.pvLedger.createMany({data:[data],skipDuplicates:true})).count).toBe(0);
  await db.pvLedger.create({data:{...data,sourceId:randomUUID(),occurredAt:end}});
  await db.pvLedger.create({data:{...data,sourceId:randomUUID(),ruleVersionCode:'TEST_OTHER_'+randomUUID()}});
  await db.pvLedger.create({data:{...data,sourceType:'RETURN',sourceId:randomUUID(),eventType:'GPV_REVERSAL',amount:-100,reversalOfEventId:original.eventId}});
  expect(await db.periodCloseReceipt.findUnique({where:{periodCloseJobId:job.periodCloseJobId}})).toEqual(receipt);
  expect(await db.historicalReplaySnapshot.findUnique({where:{snapshotId:receipt.snapshotId}})).toEqual(snapshot);
 });
 it('waits for a source already writing and includes its committed volume in the close',async()=>{
  const {data,lease}=await fixture(),written=gate(),release=gate();
  const writer=db.$transaction(async tx=>{await insert(tx,data);written.resolve();await release.promise;},{timeout:30000});
  await written.promise;
  let completed=false;
  const closing=processPeriodCloseJob(db,lease,executePeriodClose).then(r=>{completed=true;return r;});
  try{await waitForBlockedVolumeLock();expect(completed).toBe(false);}finally{release.resolve();}
  await writer;const receipt=await closing;
  expect('sourceId' in receipt).toBe(true);
  const batch=await db.settlementBatch.findUniqueOrThrow({where:{settlementBatchId:(receipt as any).sourceId}});
  expect(batch.totalGpv.toString()).toBe('100');
 });
 it.each([Prisma.TransactionIsolationLevel.ReadCommitted,Prisma.TransactionIsolationLevel.Serializable])('rejects or serializes a writer arriving during close (%s)',async isolationLevel=>{
  const {data,job,lease}=await fixture(),locked=gate(),release=gate();
  const closing=processPeriodCloseJob(db,lease,async(tx,manifest)=>{locked.resolve();await release.promise;return executePeriodClose(tx,manifest);});
  await locked.promise;
  let completed=false;
  const writer=db.$transaction(tx=>insert(tx,data),{isolationLevel,timeout:30000}).then(()=>({ok:true,error:''}),error=>({ok:false,error:String(error)})).then(result=>{completed=true;return result;});
  try{await waitForBlockedVolumeLock();expect(completed).toBe(false);}finally{release.resolve();}
  await closing;
  const outcome=await writer;expect(outcome.ok).toBe(false);
  expect(outcome.error).toMatch(/PERIOD_CLOSE_LATE_INPUT_REQUIRES_CORRECTION|write conflict|serializ/i);
  expect(await db.pvLedger.count({where:{ruleVersionCode:data.ruleVersionCode}})).toBe(0);
  expect(await db.periodCloseReceipt.count({where:{periodCloseJobId:job.periodCloseJobId}})).toBe(1);
 });
});
