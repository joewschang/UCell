import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { RpvService } from '../src/modules/rpv/rpv.service';
import { EpvService } from '../src/modules/epv/epv.service';
import { EpvMonthService } from '../src/modules/epv/epv-month.service';
import { BonusQueryService } from '../src/modules/bonus/bonus-query.service';
import { RuntimeRuleService } from '../src/modules/rules/runtime-rule.service';
import { pollRecognitions, processRecognition } from '../../worker/src/main';
import {pollRecognitionQueue} from '../../worker/src/recognition-poll';

const url = process.env.PHASE2_TEST_DATABASE_URL;
if (!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))) throw Error('ISOLATED_DATABASE_REQUIRED');
describe('Production recognition retry rolls back complete transactions', () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  let rule: string, product: any, plan: any;
  const at = new Date('2024-01-24T00:00:00+08:00'), from = new Date('2023-12-01Z');
  beforeAll(async () => {
    rule = 'TEST_RETRY_' + randomUUID();
    const rows = await db.runtimeRuleParameter.findMany({ where: { ruleVersionCode: 'R1.0B' }, orderBy: { effectiveFrom: 'asc' } });
    for (const r of new Map(rows.map(r => [JSON.stringify([r.parameterCode, r.scopeKey]), r])).values())
      await db.runtimeRuleParameter.create({ data: { ruleVersionCode: rule, parameterCode: r.parameterCode, scopeKey: r.scopeKey, valueJson: ['accounting.timezone', 'epv.calendar.timezone'].includes(r.parameterCode) ? 'Asia/Taipei' : r.valueJson!, effectiveFrom: from } });
    product = await db.productReference.create({ data: { sku: randomUUID(), displayName: 'Synthetic retry', currentPrice: 3000 } });
    plan = await db.subscriptionPlan.create({ data: { planCode: rule, displayName: 'Synthetic retry', durationMonths: 1, prepaidAmount: 2000, productBoxQty: 1, monthlyRecognizedAmount: 2000, monthlyRpv: 1200 } });
  });
  afterAll(() => db.$disconnect());
  async function fixture() {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const person = await db.person.create({ data: { legalName: 'SYNTHETIC RETRY' } });
      const q = await db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: 'STARTER', status: 'EFFECTIVE', effectiveAt: from } });
      ids.push(q.qualificationId);
      await db.qualificationPlanHistory.create({ data: { qualificationId: q.qualificationId, planCode: 'STARTER', effectiveFrom: from, sourceType: 'TEST' } });
      await db.qualificationStatusHistory.create({ data: { qualificationId: q.qualificationId, status: 'EFFECTIVE', effectiveFrom: from, sourceType: 'TEST' } });
      await db.activePeriod.create({ data: { qualificationId: q.qualificationId, activeFrom: from, sourceType: 'TEST', ruleVersionCode: rule } });
    }
    await db.binaryPlacement.create({ data: { parentQualificationId: ids[1], childQualificationId: ids[0], side: 'LEFT', effectiveFrom: from } });
    await db.sponsorRelationship.create({ data: { sponsorQualificationId: ids[1], childQualificationId: ids[0], sponsorSequenceNo: 1, effectiveFrom: from } });
    const sub = await db.subscription.create({ data: { qualificationId: ids[0], subscriptionPlanId: plan.subscriptionPlanId, status: 'ACTIVE', startMonth: new Date('2024-01-01Z'), endMonth: new Date('2024-01-01Z'), ruleVersionCode: rule } });
    const schedule = await db.monthlyRecognitionSchedule.create({ data: { subscriptionId: sub.subscriptionId, installmentNo: 1, recognitionMonth: new Date('2024-01-01Z'), dueAt: at, recognizedAmount: 2000, rpvAmount: 1200, ruleVersionCode: rule } });
    const order = await db.order.create({ data: { qualificationId: ids[0], purpose: 'REPURCHASE', status: 'PAID', paidAt: at, grossAmount: 3000, netAmount: 3000, ruleVersionCode: rule,
      lines: { create: { productId: product.productId, skuSnapshot: product.sku, productNameSnapshot: product.displayName, quantity: 1, unitPrice: 3000, lineAmount: 3000, gpvRateSnapshot: 0, gpvAmountSnapshot: 0, ruleProfileSnapshot: { synthetic: true } } } } });
    return { ids, schedule, order };
  }
  function invoke(channel: string, client: any, f: Awaited<ReturnType<typeof fixture>>) {
    if (channel === 'WORKER_RPV') return processRecognition(f.schedule.recognitionId, client);
    if (channel === 'API_RPV') return new RpvService(client, {} as any).recognize(f.schedule.recognitionId);
    return new EpvService(client, new RuntimeRuleService(client), new BonusQueryService(client), new EpvMonthService()).recognizeOrder(f.order.orderId, rule);
  }
  const channels = ['API_RPV', 'WORKER_RPV', 'API_EPV'];
  it.each(channels.flatMap(channel => ['P2034', '40001', '40P01'].map(code => ({ channel, code }))))('$channel retries $code after all writes without duplicate money or messages', async ({ channel, code }) => {
    const f = await fixture(); let attempts = 0;
    const client = { $transaction: (work: any, options: any) => db.$transaction(async tx => {
      attempts++; const result = await work(tx);
      if (attempts === 1) throw new Prisma.PrismaClientKnownRequestError('Synthetic post-write abort', { clientVersion: 'test', code: code === 'P2034' ? code : 'P2010', meta: code === 'P2034' ? undefined : { code } });
      return result;
    }, options) };
    await invoke(channel, client, f);
    expect(attempts).toBe(2);
    const pvType = channel === 'API_EPV' ? 'EPV' : 'RPV';
    const events = await db.pvLedger.findMany({ where: { qualificationId: f.ids[0], pvType } });
    expect(events).toHaveLength(1); expect(events[0].amount.toString()).toBe(pvType === 'EPV' ? '600' : '1200');
    if (pvType === 'EPV') {
      const awards = await db.bonusAward.findMany({ where: { sourceEventId: events[0].eventId }, orderBy: { generationNo: 'asc' } });
      expect(awards.map(a => a.payableAmount.toString())).toEqual(['300', '36']);
    } else {
      expect((await db.rpvUplineAwardEvent.findMany({ where: { recognitionId: f.schedule.recognitionId } })).map(a => a.payableAmount.toString())).toEqual(['100']);
      expect(await db.memberNotification.count({ where: { messageKey: 'repurchase:recognized:' + f.schedule.recognitionId } })).toBe(1);
    }
    expect(await db.historicalReplaySnapshot.count({ where: { sourceId: pvType === 'EPV' ? events[0].eventId : f.schedule.recognitionId, kind: pvType } })).toBe(1);
    await invoke(channel, db, f);
    expect(await db.pvLedger.count({ where: { qualificationId: f.ids[0], pvType } })).toBe(1);
  }, 20000);
  it.each(channels)('%s exhausts four aborted attempts without leaving financial rows, then accepts redelivery', async channel => {
    const f = await fixture(); let attempts = 0;
    const client = { $transaction: (work: any, options: any) => db.$transaction(async tx => {
      attempts++; await work(tx);
      throw new Prisma.PrismaClientKnownRequestError('Synthetic repeated abort', { clientVersion: 'test', code: 'P2034' });
    }, options) };
    const error = await invoke(channel, client, f).catch(e => e);
    expect(attempts).toBe(4);
    if (channel === 'WORKER_RPV') expect(error.code).toBe('P2034');
    else { expect(error.getStatus()).toBe(409); expect(error.getResponse()).toMatchObject({ code: 'RECOGNITION_RETRY_EXHAUSTED', details: { retryable: true, attempts: 4 } }); }
    expect(await db.pvLedger.count({ where: { qualificationId: f.ids[0] } })).toBe(0);
    expect(await db.bonusAward.count({ where: { sourceQualificationId: f.ids[0] } })).toBe(0);
    expect(await db.rpvUplineAwardEvent.count({ where: { recognitionId: f.schedule.recognitionId } })).toBe(0);
    expect(await db.memberNotification.count({ where: { qualificationId: f.ids[0] } })).toBe(0);
    expect((await db.monthlyRecognitionSchedule.findUniqueOrThrow({ where: { recognitionId: f.schedule.recognitionId } })).status).toBe('SCHEDULED');
    await invoke(channel, db, f);
    expect(await db.pvLedger.count({ where: { qualificationId: f.ids[0] } })).toBe(1);
  }, 20000);

  it('Worker polling retains exhausted work, then the next poll commits exactly once', async () => {
    // Remove only unused synthetic schedules from preceding EPV cases so the
    // actual production poll can select all due rows without a mocked query.
    await db.monthlyRecognitionSchedule.updateMany({ where: { ruleVersionCode: rule, status: 'SCHEDULED' }, data: { status: 'CANCELLED' } });
    const f = await fixture(); let attempts = 0;
    const client = { monthlyRecognitionSchedule: db.monthlyRecognitionSchedule,
      $transaction: (work: any, options: any) => db.$transaction(async tx => {
        attempts++; const result = await work(tx);
        if (attempts <= 4) throw new Prisma.PrismaClientKnownRequestError('Synthetic poll abort', { clientVersion: 'test', code: 'P2034' });
        return result;
      }, options) };
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await pollRecognitions(client as any);
      expect(attempts).toBe(4);
      expect((await db.monthlyRecognitionSchedule.findUniqueOrThrow({ where: { recognitionId: f.schedule.recognitionId } })).status).toBe('SCHEDULED');
      expect(await db.pvLedger.count({ where: { sourceLineId: f.schedule.recognitionId } })).toBe(0);
      await pollRecognitions(client as any);expect(attempts).toBe(4);
      const failed=await db.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId:f.schedule.recognitionId}});
      expect(failed.workerFailureCount).toBe(1);expect(failed.workerBlocked).toBe(false);
      await pollRecognitions(client as any,failed.workerNextAttemptAt!); await pollRecognitions(client as any);
      expect(attempts).toBe(5);
      expect(await db.pvLedger.count({ where: { sourceLineId: f.schedule.recognitionId } })).toBe(1);
      expect(await db.memberNotification.count({ where: { messageKey: 'repurchase:recognized:' + f.schedule.recognitionId } })).toBe(1);
      expect(await db.rpvUplineAwardEvent.count({ where: { recognitionId: f.schedule.recognitionId } })).toBe(1);
    } finally { log.mockRestore(); }
  }, 20000);
  it('isolates the first twenty bad schedules durably and processes the twenty-first after reconnect',async()=>{
    await db.monthlyRecognitionSchedule.updateMany({where:{ruleVersionCode:rule,status:'SCHEDULED'},data:{status:'CANCELLED'}});
    const f=await fixture();
    const bad=[];
    for(let i=0;i<20;i++)bad.push(await db.monthlyRecognitionSchedule.create({data:{subscriptionId:f.schedule.subscriptionId,installmentNo:i+2,recognitionMonth:at,dueAt:new Date(at.getTime()-60000-i),recognizedAmount:2000,rpvAmount:1200,ruleVersionCode:rule}}));
    const log=jest.spyOn(console,'error').mockImplementation(()=>undefined);
    const fail=jest.fn().mockRejectedValue(Error('PRIVATE failure details'));
    try{
      await pollRecognitionQueue(db as any,fail);expect(fail).toHaveBeenCalledTimes(20);
      const failures=await db.monthlyRecognitionSchedule.findMany({where:{recognitionId:{in:bad.map(s=>s.recognitionId)}}});
      expect(failures.every(s=>s.workerBlocked&&s.workerFailureCount===1&&s.workerLastTraceId&&s.workerLastErrorCode==='RECOGNITION_REVIEW_REQUIRED')).toBe(true);
      expect(JSON.stringify(failures)).not.toContain('PRIVATE');
      const restarted=new PrismaClient({datasources:{db:{url}}});
      try{await pollRecognitions(restarted as any);}finally{await restarted.$disconnect();}
      expect(await db.pvLedger.count({where:{sourceLineId:f.schedule.recognitionId}})).toBe(1);
      expect(await db.pvLedger.count({where:{sourceLineId:{in:bad.map(s=>s.recognitionId)}}})).toBe(0);
      // Operator reruns the original schedule through the existing API after repair.
      const api=new RpvService(db as any,{} as any);await api.recognize(bad[0].recognitionId);await api.recognize(bad[0].recognitionId);await pollRecognitions(db as any);
      const repaired=await db.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId:bad[0].recognitionId}});
      expect(repaired.status).toBe('RECOGNIZED');expect(repaired.workerBlocked).toBe(false);expect(repaired.workerFailureCount).toBe(1);
      expect(await db.pvLedger.count({where:{sourceLineId:bad[0].recognitionId}})).toBe(1);
      expect(await db.rpvUplineAwardEvent.count({where:{recognitionId:bad[0].recognitionId}})).toBe(1);
      expect(await db.memberNotification.count({where:{messageKey:'repurchase:recognized:'+bad[0].recognitionId}})).toBe(1);
    }finally{log.mockRestore();}
  },30000);
  it('backs off confirmed conflicts and stops automatic polling after five failures',async()=>{
    const f=await fixture(),log=jest.spyOn(console,'error').mockImplementation(()=>undefined);
    const fail=jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('conflict',{clientVersion:'test',code:'P2034'}));let now=new Date();
    try{
      for(let n=1;n<=5;n++){
        await pollRecognitionQueue(db as any,fail,now);
        const row=await db.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId:f.schedule.recognitionId}});
        expect(row.workerFailureCount).toBe(n);expect(row.workerBlocked).toBe(n===5);
        if(n<5){expect(row.workerNextAttemptAt!.getTime()-now.getTime()).toBe(60000*2**(n-1));await pollRecognitionQueue(db as any,fail,new Date(row.workerNextAttemptAt!.getTime()-1));expect(fail).toHaveBeenCalledTimes(n);now=row.workerNextAttemptAt!;}
      }
      await pollRecognitionQueue(db as any,fail,new Date(now.getTime()+86400000));expect(fail).toHaveBeenCalledTimes(5);
    }finally{log.mockRestore();}
  });
  it('does not let stale failure recording overwrite a concurrently successful recognition',async()=>{
    const f=await fixture(),log=jest.spyOn(console,'error').mockImplementation(()=>undefined);
    try{
      await pollRecognitionQueue(db as any,async id=>{await processRecognition(id,db as any);throw Error('late failure');});
      const row=await db.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId:f.schedule.recognitionId}});
      expect(row.status).toBe('RECOGNIZED');expect(row.workerFailureCount).toBe(0);expect(row.workerBlocked).toBe(false);
    }finally{log.mockRestore();}
  });
  it.each(['RPV_API_WORKER', 'EPV_API_API'])('%s concurrent duplicate requests converge without caller retries', async mode => {
    const f = await fixture(); let arrived = 0, release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const model = mode === 'RPV_API_WORKER' ? 'monthlyRecognitionSchedule' : 'order';
    function competingClient() {
      let firstRead = true;
      return { $transaction: (work: any, options: any) => db.$transaction(tx => work(new Proxy(tx, {
        get(target, key) {
          if (key !== model) return (target as any)[key];
          const delegate = (target as any)[key];
          return { ...delegate, findUnique: async (args: any) => {
            const result = await delegate.findUnique(args);
            if (firstRead) { firstRead = false; if (++arrived === 2) release(); await barrier; }
            return result;
          } };
        },
      })), options) };
    }
    const channels = mode === 'RPV_API_WORKER' ? ['API_RPV', 'WORKER_RPV'] : ['API_EPV', 'API_EPV'];
    await Promise.all(channels.map(channel => invoke(channel, competingClient(), f)));
    const pvType = mode === 'RPV_API_WORKER' ? 'RPV' : 'EPV';
    const events = await db.pvLedger.findMany({ where: { qualificationId: f.ids[0], pvType } });
    expect(events).toHaveLength(1);
    if (pvType === 'RPV') {
      expect(await db.rpvUplineAwardEvent.count({ where: { recognitionId: f.schedule.recognitionId } })).toBe(1);
      expect(await db.memberNotification.count({ where: { messageKey: 'repurchase:recognized:' + f.schedule.recognitionId } })).toBe(1);
    } else expect((await db.bonusAward.findMany({ where: { sourceEventId: events[0].eventId }, orderBy: { generationNo: 'asc' } })).map(a => a.payableAmount.toString())).toEqual(['300', '36']);
    expect(await db.historicalReplaySnapshot.count({ where: { kind: pvType, sourceId: pvType === 'RPV' ? f.schedule.recognitionId : events[0].eventId } })).toBe(1);
  }, 20000);
});
