import {PrismaClient,Prisma} from '@prisma/client';
import {enqueuePeriodCloseJob,claimPeriodCloseJob,processPeriodCloseJob,releaseFailedOutboxLease,PeriodCloseKind} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {SettlementCalendarService} from '../src/modules/settlement/settlement-calendar.service';
import {ReferralBonusService} from '../src/modules/bonus/referral-bonus.service';
import {BinaryBonusService} from '../src/modules/bonus/binary-bonus.service';
import {GlobalPoolService} from '../src/modules/global-pool/global-pool.service';
import {GlobalPoolPersistence} from '../src/modules/global-pool/global-pool-persistence';
import {RuntimeRuleService} from '../src/modules/rules/runtime-rule.service';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('durable period-close admission, dependencies and fenced execution',()=>{
  let db:PrismaClient;
  const start=new Date('1893-01-01T00:00:00Z'),end=new Date('1893-01-08T00:00:00Z');
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());
  async function rule(){
    const code=`TEST_CLOSE_JOB_${randomUUID()}`;
    const values:Array<[string,string,Prisma.InputJsonValue]>=[['award.pending.days','*','45'],['pool.referral.rate','*','0.5'],['pool.binary.rate','*','0.2'],['pool.matching.rate','*','0.2'],['binary.pair.rate','*','0.1'],['pool.global.rate','*','0.05']];
    for(const kind of ['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'])values.push(
      ['settlement.timezone',kind,'UTC'],['settlement.period',kind,{unit:'WEEK',count:1,anchorLocal:'1893-01-01T00:00:00'}],
      ['settlement.cut_off',kind,{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_CALENDAR'}]);
    for(const rank of ['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'])values.push(['global.rank.weak_threshold',rank,'1000'],['global.rank.pool_rate',rank,'0.01']);
    for(const [parameterCode,scopeKey,valueJson] of values)await db.runtimeRuleParameter.create({data:{ruleVersionCode:code,parameterCode,scopeKey,valueJson,effectiveFrom:new Date('1890-01-01Z'),effectiveTo:new Date('1894-01-01Z')}});
    return code;
  }
  function enqueue(kind:PeriodCloseKind,code:string,prerequisiteIds:string[]=[],approvalReference='TEST_APPROVAL'){
    return enqueuePeriodCloseJob(db,{kind,periodStart:start,periodEnd:end,ruleVersionCode:code,prerequisiteIds,approvalReference,requestedBy:'TEST_FINANCE'},tx=>new SettlementCalendarService(db as any).captureForPeriod(tx,start,end,kind,code));
  }
  async function execute(tx:Prisma.TransactionClient,job:any){
    // Reuse actual engines within the lease transaction, never open a nested commit.
    const client=new Proxy(tx,{get(target,key){return key==='$transaction'?(work:any)=>work(tx):Reflect.get(target,key);}}) as any;
    const rules=new RuntimeRuleService(client),query=new BonusQueryService(client),calendar=new SettlementCalendarService(client);
    if(job.kind==='GLOBAL')return (await new GlobalPoolService(client,rules,query,calendar,new GlobalPoolPersistence()).evaluateAndSettle(job.periodStart,job.periodEnd,job.ruleVersionCode)).globalPoolSettlementId;
    if(job.kind==='REFERRAL_K0')return (await new ReferralBonusService(client,rules,query,calendar).settle(job.periodStart,job.periodEnd,job.ruleVersionCode)).settlementBatchId;
    const binary=new BinaryBonusService(client,rules,query,calendar);
    return (await (job.kind==='BINARY_K1'?binary.settleBinary(job.periodStart,job.periodEnd,job.ruleVersionCode):binary.settleMatching(job.periodStart,job.periodEnd,job.ruleVersionCode))).settlementBatchId;
  }
  it('deduplicates simultaneous admission and rejects changed approval/dependencies',async()=>{
    const code=await rule();
    const jobs=await Promise.all([enqueue('REFERRAL_K0',code),enqueue('REFERRAL_K0',code)]);
    expect(jobs[0]).toEqual(jobs[1]);
    expect(await db.outboxEvent.count({where:{aggregateId:jobs[0].periodCloseJobId}})).toBe(1);
    await expect(enqueue('REFERRAL_K0',code,[],'CHANGED')).rejects.toThrow('PERIOD_CLOSE_REQUEST_CONFLICT');
    await expect(enqueue('REFERRAL_K0',code,[randomUUID()])).rejects.toThrow('PERIOD_CLOSE_REQUEST_CONFLICT');
  });
  it('rejects missing, cross-rule and missing Binary prerequisites before writing Outbox',async()=>{
    const code=await rule(),other=await enqueue('BINARY_K1',await rule());
    await expect(enqueue('MATCHING_K2',code)).rejects.toThrow('PERIOD_CLOSE_BINARY_REQUIRED');
    await expect(enqueue('MATCHING_K2',code,[randomUUID()])).rejects.toThrow('PERIOD_CLOSE_PREREQUISITE_INVALID');
    await expect(enqueue('MATCHING_K2',code,[other.periodCloseJobId])).rejects.toThrow('PERIOD_CLOSE_PREREQUISITE_INVALID');
    expect(await db.periodCloseJob.count({where:{ruleVersionCode:code}})).toBe(0);
  });
  it('keeps blocked jobs unclaimed, then executes Binary before Matching with one lease owner',async()=>{
    const code=await rule(),binary=await enqueue('BINARY_K1',code),matching=await enqueue('MATCHING_K2',code,[binary.periodCloseJobId]);
    for(let i=0;i<12;i++)expect(await claimPeriodCloseJob(db,matching.periodCloseJobId)).toBeNull();
    expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:matching.outboxEventId}})).attemptCount).toBe(0);
    const claims=await Promise.all([claimPeriodCloseJob(db,binary.periodCloseJobId),claimPeriodCloseJob(db,binary.periodCloseJobId)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    await processPeriodCloseJob(db,claims.find(Boolean)!,execute);
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,matching.periodCloseJobId))!,execute);
    expect(await db.periodCloseReceipt.count({where:{periodCloseJobId:{in:[binary.periodCloseJobId,matching.periodCloseJobId]}}})).toBe(2);
    expect(await claimPeriodCloseJob(db,matching.periodCloseJobId)).toBeNull();
  });
  it.each(['REFERRAL_K0','GLOBAL'] as const)('atomically records %s sealed result and rejects delivery replay',async kind=>{
    const job=await enqueue(kind,await rule()),lease=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    const receipt=await processPeriodCloseJob(db,lease,execute);
    expect(receipt).toHaveProperty('snapshotId');
    expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}})).processStatus).toBe('PROCESSED');
    const callback=jest.fn(execute);
    expect(await processPeriodCloseJob(db,lease,callback)).toEqual({lostLease:true});expect(callback).not.toHaveBeenCalled();
  });
  it('rolls back settlement and receipt on failure, then recovers with a new lease',async()=>{
    const job=await enqueue('REFERRAL_K0',await rule()),lease=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    await expect(processPeriodCloseJob(db,lease,async(tx,row)=>{await execute(tx,row);throw new Error('AFTER_SETTLEMENT');})).rejects.toThrow('AFTER_SETTLEMENT');
    expect(await db.settlementBatch.count({where:{ruleVersionCode:job.ruleVersionCode}})).toBe(0);
    expect(await db.periodCloseReceipt.count({where:{periodCloseJobId:job.periodCloseJobId}})).toBe(0);
    await releaseFailedOutboxLease(db,lease,new Error('AFTER_SETTLEMENT'),new Date(Date.now()-31000));
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute);
    expect(await db.periodCloseReceipt.count({where:{periodCloseJobId:job.periodCloseJobId}})).toBe(1);
  });
  it('fences expired owners and prevents their failure handler from overwriting recovery',async()=>{
    const job=await enqueue('BINARY_K1',await rule()),first=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    await db.outboxEvent.update({where:{outboxEventId:job.outboxEventId},data:{availableAt:new Date(Date.now()-1000)}});
    const second=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    const callback=jest.fn(execute);
    expect(await processPeriodCloseJob(db,first,callback)).toEqual({lostLease:true});expect(callback).not.toHaveBeenCalled();
    await processPeriodCloseJob(db,second,execute);
    expect((await releaseFailedOutboxLease(db,first,new Error('STALE'))).count).toBe(0);
  });
  it('fails closed on parameter drift and preserves immutable job/receipt evidence',async()=>{
    const job=await enqueue('REFERRAL_K0',await rule());
    await expect(db.periodCloseJob.update({where:{periodCloseJobId:job.periodCloseJobId},data:{approvalReference:'MUTATED'}})).rejects.toThrow();
    await db.runtimeRuleParameter.updateMany({where:{ruleVersionCode:job.ruleVersionCode,parameterCode:'pool.referral.rate'},data:{valueJson:'0.4'}});
    await expect(processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute)).rejects.toThrow('PERIOD_CLOSE_RESULT_MISMATCH');
    expect(await db.settlementBatch.count({where:{ruleVersionCode:job.ruleVersionCode}})).toBe(0);
    const clean=await enqueue('REFERRAL_K0',await rule());
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,clean.periodCloseJobId))!,execute);
    await expect(db.periodCloseReceipt.delete({where:{periodCloseJobId:clean.periodCloseJobId}})).rejects.toThrow();
  });
});
