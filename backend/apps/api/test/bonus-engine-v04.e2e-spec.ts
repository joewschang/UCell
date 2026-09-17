import { ReferralBonusService } from '../src/modules/bonus/referral-bonus.service';
import { BinaryBonusService } from '../src/modules/bonus/binary-bonus.service';
import { BonusLifecycleService } from '../src/modules/bonus/bonus-lifecycle.service';
import { BonusQueryService } from '../src/modules/bonus/bonus-query.service';
import { Prisma, captureParameters } from '@ucell/database';
import { source, sealed } from './phase2-fixtures';

// Persistence sealing has independent DB regressions; these cases exercise the
// actual settlement arithmetic and writes, with transaction-local persistence.
jest.mock('@ucell/database', () => ({
  ...jest.requireActual('@ucell/database'), sealSettlement: jest.fn(async () => undefined),
}));

async function matchingHarness(volume = '1000', paid = '200', theory = '1000') {
  const start = new Date('2020-01-01'), end = new Date('2020-01-08');
  const rows = [
    ['award.pending.days', '*', '45'], ['pool.matching.rate', '*', '0.15'],
    ...['0.15', '0.10', '0.05', '0.05', '0.05'].map((rate, i) => ['matching.rate', String(i + 1), rate]),
  ].map(([parameterCode, scopeKey, valueJson], i) => ({
    runtimeRuleParameterId: String(i), parameterCode, scopeKey, valueJson,
    effectiveFrom: new Date('2019-01-01'), effectiveTo: null,
  }));
  const snapshot = await captureParameters({runtimeRuleParameter: {findMany: async () => rows}} as any, start, 'TEST_ONLY');
  const envelope = source(); envelope.inputs.volume = volume;
  const awards: any[] = [], lifecycle: any[] = [], evidence: any[] = [];
  const binary = {settlementBatchId: 'binary', status: 'FINALIZED'};
  const tx = {
    settlementBatch: {
      findUnique: jest.fn(async ({where}: any) => where.settlementType_periodStart_periodEnd_ruleVersionCode.settlementType === 'BINARY_K1' ? binary : null),
      create: jest.fn(async ({data}: any) => ({...data, settlementBatchId: 'matching'})),
      update: jest.fn(async ({data}: any) => ({...data, settlementBatchId: 'matching', parameterSnapshot: snapshot})),
    },
    pvLedger: {findMany: jest.fn(async () => [{eventId: 'left'}])},
    historicalReplaySnapshot: {findUnique: jest.fn(async () => sealed(envelope))},
    returnLine: {aggregate: jest.fn(async () => ({_sum: {gpvReversalAmount: null}}))},
    bonusAward: {
      findMany: jest.fn(async () => [{bonusAwardId: 'binary-award', recipientQualificationId: 'binary-recipient', payableAmount: new Prisma.Decimal(paid), theoryAmount: new Prisma.Decimal(theory)}]),
      create: jest.fn(async ({data}: any) => {const award = {...data, bonusAwardId: `matching-${awards.length}`}; awards.push(award); return award;}),
    },
    bonusCalculationEvidence: {
      create: jest.fn(async ({data}: any) => {evidence.push(data); return data;}),
      createMany: jest.fn(async ({data}: any) => {evidence.push(...data); return {count:data.length};}),
    },
    bonusAwardLifecycleEvent: {createMany: jest.fn(async ({data}: any) => {lifecycle.push(...data); return {count: data.length};})},
  };
  const query = {
    sponsorAncestors: jest.fn(async () => [1, 2, 3, 4, 5].map(generation => ({qualification_id: `sponsor-${generation}`, generation}))),
    effectiveDirectCountAt: jest.fn(async () => 4), isActiveAt: jest.fn(async () => true),
    qualificationPlanAt: jest.fn(async () => 'LEADER'),
    pendingUntil: jest.fn((at: Date, days: number) => new Date(at.getTime() + days * 86400000)),
  };
  const prisma = {$transaction: jest.fn(async (work: any) => work(tx))};
  const service = new BinaryBonusService(prisma as any, {} as any, query as any, {captureForPeriod: async () => snapshot} as any);
  return {service, tx, query, prisma, awards, lifecycle, evidence, start, end};
}
function lifecycleHarness() {
  const pendingUntil=new Date('2020-02-01'),award={bonusAwardId:'award-A',pendingUntil,payableAmount:'100'};
  const events:any[]=[{bonusAwardId:'award-A',status:'PENDING_45D',occurredAt:new Date('2020-01-01')}];
  const tx={
    $queryRaw:jest.fn(async()=>[{bonus_award_id:'award-A'}]),
    bonusAwardLifecycleEvent:{findFirst:jest.fn(async()=>events[events.length-1]),create:jest.fn(async({data}:any)=>{events.push(data);return data;})},
    bonusAward:{update:jest.fn(),delete:jest.fn()},
  };
  const prisma={bonusAward:{findMany:jest.fn(async({where}:any)=>pendingUntil<=where.pendingUntil.lte?[award]:[])},$transaction:jest.fn(async(work:any)=>work(tx))};
  return {service:new BonusLifecycleService(prisma as any),prisma,tx,events,award,pendingUntil};
}

async function testSnapshot(entries: string[][]) {
  const rows = entries.map(([parameterCode, scopeKey, valueJson], i) => ({
    runtimeRuleParameterId: String(i), parameterCode, scopeKey, valueJson,
    effectiveFrom: new Date('2019-01-01'), effectiveTo: null,
  }));
  return captureParameters({runtimeRuleParameter: {findMany: async () => rows}} as any, new Date('2020-01-01'), 'TEST_ONLY');
}

async function binaryHarness(left = '1000', right = '1000', leftIn = '0', rightIn = '0', plan = 'STARTER') {
  const start = new Date('2020-01-01'), end = new Date('2020-01-08');
  const snapshot = await testSnapshot([
    ['award.pending.days', '*', '45'], ['pool.binary.rate', '*', '0.36'], ['binary.pair.rate', '*', '0.12'],
    ['binary.weekly.cap', 'STARTER', '450000'], ['binary.weekly.cap', 'ELITE', '900000'], ['binary.weekly.cap', 'LEADER', '1500000'],
  ]);
  const sources = [source(), source('right', 'RIGHT')];
  sources[0].inputs.volume = left; sources[1].inputs.volume = right;
  const awards: any[] = [], carries: any[] = [], lifecycle: any[] = [], evidence: any[] = [];
  const previous = {periodEnd: new Date('2019-12-25'), leftCarryOut: new Prisma.Decimal(leftIn), rightCarryOut: new Prisma.Decimal(rightIn)};
  const tx = {
    settlementBatch: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({data}: any) => ({...data, settlementBatchId: 'binary'})),
      update: jest.fn(async ({data}: any) => ({...data, settlementBatchId: 'binary', parameterSnapshot: snapshot})),
    },
    pvLedger: {findMany: jest.fn(async () => sources.map(s => ({eventId: s.sourceId})))},
    historicalReplaySnapshot: {findUnique: jest.fn(async ({where}: any) => sealed(sources.find(s => s.sourceId === where.kind_sourceId.sourceId)!))},
    returnLine: {aggregate: jest.fn(async () => ({_sum: {gpvReversalAmount: null}}))},
    qualification: {findMany: jest.fn(async () => [{qualificationId: 'root'}])},
    qualificationStatusHistory: {findFirst: jest.fn(async () => ({status: 'EFFECTIVE'}))},
    qualificationPlanHistory: {findFirst: jest.fn(async () => ({planCode: plan}))},
    activePeriod: {findFirst: jest.fn(async () => ({activeFrom: start, activeTo: null}))},
    binaryCarry: {
      findFirst: jest.fn(async () => previous),
      create: jest.fn(async ({data}: any) => {carries.push(data); return data;}),
    },
    replayCarryProjection: {findFirst: jest.fn(async () => null)},
    bonusAward: {create: jest.fn(async ({data}: any) => {const award = {...data, bonusAwardId: `binary-${awards.length}`}; awards.push(award); return award;})},
    bonusCalculationEvidence: {
      create: jest.fn(async ({data}: any) => {evidence.push(data); return data;}),
      createMany: jest.fn(async ({data}: any) => {evidence.push(...data); return {count:data.length};}),
    },
    bonusAwardLifecycleEvent: {createMany: jest.fn(async ({data}: any) => {lifecycle.push(...data); return {count: data.length};})},
  };
  const prisma = {$transaction: jest.fn(async (work: any) => work(tx))};
  const query = new BonusQueryService(prisma as any);
  const service = new BinaryBonusService(prisma as any, {} as any, query, {captureForPeriod: async () => snapshot} as any);
  return {service, tx, sources, awards, carries, lifecycle, evidence, previous, start, end};
}

async function referralHarness(g1Plan = 'STARTER', uplinePlan = 'STARTER', g1Active = true) {
  const start = new Date('2020-01-01'), end = new Date('2020-01-08');
  const entries = [
    ['award.pending.days', '*', '45'], ['pool.referral.rate', '*', '0.42'],
    ['referral.g1.rate', 'STARTER', '0.15'], ['referral.g1.rate', 'ELITE', '0.20'], ['referral.g1.rate', 'LEADER', '0.25'],
    ...Object.entries({STARTER: ['0.10', '0.10', '0.10'], ELITE: ['0.20', '0.10', '0.10', '0.05', '0.05'], LEADER: ['0.20', '0.15', '0.10', '0.10', '0.10', '0.05']})
      .flatMap(([plan, rates]) => rates.map((rate, i) => ['equalization.rate', `${plan}:G${i + 2}`, rate])),
  ];
  const snapshot = await testSnapshot(entries);
  const envelope = source(); envelope.parameters = snapshot;
  envelope.evidence = {
    at: envelope.at, binary: [{parentQualificationId: 'binary-only', childQualificationId: 'left', side: 'RIGHT'}],
    sponsor: [1, 2, 3, 4, 5, 6, 7].map(g => ({sponsorQualificationId: `g${g}`, childQualificationId: g === 1 ? 'left' : `g${g - 1}`})),
    qualifications: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(g => [`g${g}`, {
      plan: {planCode: g === 1 ? g1Plan : uplinePlan}, status: {status: 'EFFECTIVE'},
      activeIntervals: g === 1 && !g1Active ? [] : [{activeFrom: '2019-01-01T00:00:00.000Z', activeTo: null}],
    }])),
    effectiveDirectCounts: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(g => [`g${g}`, 4])),
  };
  const sources = [envelope];
  const awards: any[] = [], lifecycle: any[] = [], evidence: any[] = [];
  const tx = {
    settlementBatch: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({data}: any) => ({...data, settlementBatchId: 'referral'})),
      update: jest.fn(async ({data}: any) => ({...data, settlementBatchId: 'referral', parameterSnapshot: snapshot})),
    },
    pvLedger: {findMany: jest.fn(async () => sources.map(s => ({eventId: s.sourceId, qualificationId: s.inputs.qualificationId, occurredAt: new Date(s.at)})))},
    historicalReplaySnapshot: {findUnique: jest.fn(async ({where}: any) => sealed(sources.find(s => s.sourceId === where.kind_sourceId.sourceId)!))},
    returnLine: {aggregate: jest.fn(async () => ({_sum: {gpvReversalAmount: null}}))},
    bonusAward: {create: jest.fn(async ({data}: any) => {const award = {...data, bonusAwardId: `referral-${awards.length}`}; awards.push(award); return award;})},
    bonusCalculationEvidence: {createMany: jest.fn(async ({data}: any) => {evidence.push(...data); return {count:data.length};})},
    bonusAwardLifecycleEvent: {createMany: jest.fn(async ({data}: any) => {lifecycle.push(...data); return {count: data.length};})},
  };
  const prisma = {$transaction: jest.fn(async (work: any) => work(tx))};
  const query = new BonusQueryService(prisma as any);
  const service = new ReferralBonusService(prisma as any, {} as any, query, {captureForPeriod: async () => snapshot} as any);
  return {service, tx, envelope, sources, awards, lifecycle, evidence, start, end};
}
describe('Bonus Engine v0.4.0', () => {
  describe('Referral / Equalization', () => {
    for (const [plan, expected] of [['STARTER', '150'], ['ELITE', '200'], ['LEADER', '250']]) {
      it(`G1 ${plan} Active receives GPV x ${plan === 'STARTER' ? 15 : plan === 'ELITE' ? 20 : 25}% theory`, async () => {
        const h = await referralHarness(plan);
        await h.service.settle(h.start, h.end, 'TEST_ONLY');
        const referral = h.awards.filter(a => a.awardType === 'REFERRAL');
        expect(referral).toHaveLength(1);
        expect(referral[0].recipientQualificationId).toBe('g1');
        expect(referral[0].theoryAmount.toString()).toBe(expected);
        expect(referral[0].planLevelSnapshot).toBe(plan);
        expect(referral[0].sourceEventId).toBe(h.envelope.sourceId);
        expect(referral[0].activeSnapshot).toBe(true);
      });
    }
    it('inactive G1 gets zero evidence while higher fixed generations still use G1 referral theory', async () => {
      const h = await referralHarness('LEADER', 'LEADER', false);
      const batch = await h.service.settle(h.start, h.end, 'TEST_ONLY');
      expect(h.awards.map(a => [a.generationNo, a.recipientQualificationId])).toEqual([
        [2,'g2'],[3,'g3'],[4,'g4'],[5,'g5'],[6,'g6'],[7,'g7'],
      ]);
      expect(h.awards.every(a => a.calculationDetail.baseG1ReferralTheory === '250')).toBe(true);
      expect(h.evidence).toHaveLength(1);
      expect(h.evidence[0]).toEqual(expect.objectContaining({
        evidenceType:'REFERRAL_ELIGIBILITY',recipientQualificationId:'g1',reasonCode:'INACTIVE'
      }));
      expect(h.evidence[0].theoreticalAmount.toString()).toBe('250');
      expect(h.evidence[0].entitlementAmount.toString()).toBe('0');
      expect(batch.totalTheory.toString()).toBe('175');
    });
    it('equalization base is same-source G1 referral theory, not GPV', async () => {
      for (const [plan, expectedBase, expectedTheory] of [['STARTER', '150', '15'], ['LEADER', '250', '25']]) {
        const h = await referralHarness(plan);
        await h.service.settle(h.start, h.end, 'TEST_ONLY');
        const equalization = h.awards.filter(a => a.awardType === 'EQUALIZATION');
        expect(equalization).toHaveLength(3);
        expect(equalization.map(a => a.theoryAmount.toString())).toEqual([expectedTheory, expectedTheory, expectedTheory]);
        for (const award of equalization) {
          expect(award.calculationDetail.baseG1ReferralTheory).toBe(expectedBase);
          expect(award.sourceEventId).toBe(h.envelope.sourceId);
          expect(award.sourceQualificationId).toBe('left');
        }
      }
      const h = await referralHarness();
      const second = structuredClone(h.envelope);
      second.sourceId = 'second';
      second.inputs = {...second.inputs, qualificationId: 'second', orderId: 'second', lineId: 'second', volume: '2000'};
      second.evidence.sponsor[0].childQualificationId = 'second';
      second.evidence.qualifications.g1.plan.planCode = 'LEADER';
      h.sources.push(second);
      await h.service.settle(h.start, h.end, 'TEST_ONLY');
      expect(h.awards.filter(a => a.awardType === 'EQUALIZATION').map(a => [a.sourceEventId, a.calculationDetail.baseG1ReferralTheory, a.theoryAmount.toString()])).toEqual([
        ['left', '150', '15'], ['left', '150', '15'], ['left', '150', '15'],
        ['second', '500', '50'], ['second', '500', '50'], ['second', '500', '50'],
      ]);
    });
    for (const [plan, title, theories] of [
      ['STARTER', 'STARTER rates G2/G3/G4 are 10/10/10', ['15', '15', '15']],
      ['ELITE', 'ELITE rates G2..G6 are 20/10/10/5/5', ['30', '15', '15', '7.5', '7.5']],
      ['LEADER', 'LEADER rates G2..G7 are 20/15/10/10/10/5 including G5=10', ['30', '22.5', '15', '15', '15', '7.5']],
    ] as const) {
      it(title, async () => {
        const h = await referralHarness('STARTER', plan);
        await h.service.settle(h.start, h.end, 'TEST_ONLY');
        const equalization = h.awards.filter(a => a.awardType === 'EQUALIZATION');
        expect(equalization.map(a => a.theoryAmount.toString())).toEqual([...theories]);
        expect(equalization.map(a => [a.generationNo, a.recipientQualificationId])).toEqual(theories.map((_, i) => [i + 2, `g${i + 2}`]));
        expect(equalization.map(a => a.planLevelSnapshot)).toEqual(theories.map(() => plan));
      });
    }
    it('intermediate ineligible generation does not block higher generation', async () => {
      for (const reason of ['inactive', 'locked']) {
        const h = await referralHarness();
        if (reason === 'inactive') h.envelope.evidence.qualifications.g2.activeIntervals = [];
        else h.envelope.evidence.effectiveDirectCounts.g2 = 0;
        await h.service.settle(h.start, h.end, 'TEST_ONLY');
        expect(h.awards.filter(a => a.awardType === 'EQUALIZATION').map(a => [a.generationNo, a.recipientQualificationId, a.theoryAmount.toString()])).toEqual([
          [3, 'g3', '15'], [4, 'g4', '15'],
        ]);
        expect(h.evidence).toHaveLength(1);
        expect(h.evidence[0]).toEqual(expect.objectContaining({
          evidenceType:'REFERRAL_MATCHING_ELIGIBILITY',recipientQualificationId:'g2',reasonCode:reason === 'inactive' ? 'INACTIVE' : 'LOCKED'
        }));
        expect(h.evidence[0].theoreticalAmount.toString()).toBe('15');
        expect(h.evidence[0].entitlementAmount.toString()).toBe('0');
      }
    });
    it('recipient plan and effective-direct count control unlock depth',()=>{
      const service=new ReferralBonusService({} as any,{} as any,{} as any,{} as any);
      expect([0,1,2,3,4].map(d=>service.equalizationUnlockDepth('STARTER',d))).toEqual([0,3,4,4,4]);
      expect([0,1,2,3,4].map(d=>service.equalizationUnlockDepth('ELITE',d))).toEqual([0,3,4,5,6]);
      expect([0,1,2,3,4].map(d=>service.equalizationUnlockDepth('LEADER',d))).toEqual([0,3,4,5,7]);
    });
    it('Referral + Equalization share 42% pool and K0', async () => {
      const h = await referralHarness('LEADER', 'LEADER');
      const batch = await h.service.settle(h.start, h.end, 'TEST_ONLY');
      expect(batch.totalGpv.toString()).toBe('1000');
      expect(batch.totalTheory.toString()).toBe('425');
      expect(batch.poolAvailable.toString()).toBe('420');
      expect(batch.poolRate.toString()).toBe('0.42');
      expect(batch.kFactor.toFixed(8)).toBe('0.98823529');
      expect(h.awards.map(a => a.payableAmount.toFixed(8))).toEqual([
        '247.05882353', '49.41176471', '37.05882353', '24.70588235', '24.70588235', '24.70588235', '12.35294118',
      ]);
      expect(h.awards.map(a => a.kFactor.toString())).toEqual(h.awards.map(() => batch.kFactor.toString()));
      const unconstrained = await referralHarness();
      expect((await unconstrained.service.settle(unconstrained.start, unconstrained.end, 'TEST_ONLY')).kFactor.toString()).toBe('1');
    });
  });

  describe('Binary', () => {
    it('uses Binary subtree GPV, not Sponsor tree', async () => {
      const h = await binaryHarness('3000', '1000');
      // Sponsor-only volume has no Binary path to root; left/right Sponsor paths
      // deliberately disagree with the archived Binary placement.
      const sponsorOnly = source('sponsor-only'); sponsorOnly.inputs.volume = '9000';
      sponsorOnly.evidence.binary = []; sponsorOnly.evidence.sponsor = [{sponsorQualificationId: 'root', childQualificationId: 'sponsor-only'}];
      h.sources.push(sponsorOnly);
      h.sources[0].evidence.sponsor = [{sponsorQualificationId: 'other-sponsor', childQualificationId: 'left'}];
      h.sources[1].evidence.sponsor = [{sponsorQualificationId: 'root', childQualificationId: 'right'}];
      // Descendant volume follows the side of the first edge beneath root.
      h.sources[0].evidence.binary = [
        {parentQualificationId: 'root', childQualificationId: 'left-branch', side: 'LEFT'},
        {parentQualificationId: 'left-branch', childQualificationId: 'left', side: 'RIGHT'},
      ];
      await h.service.settleBinary(h.start, h.end, 'TEST_ONLY');
      expect(h.carries[0].leftPeriodGpv.toString()).toBe('3000');
      expect(h.carries[0].rightPeriodGpv.toString()).toBe('1000');
      expect(h.carries[0].pairedPv.toString()).toBe('1000');
      expect(h.awards[0].theoryAmount.toString()).toBe('120');
    });
    it('pair = min(left available,right available) subject to weekly cap', async () => {
      for (const [left, right, leftIn, rightIn, expected] of [
        ['1000', '3000', '500', '100', '1500'],
        ['3000', '1000', '100', '500', '1500'],
        ['700000', '600000', '0', '0', '450000'],
        ['0', '1000', '0', '0', '0'],
      ]) {
        const h = await binaryHarness(left, right, leftIn, rightIn);
        await h.service.settleBinary(h.start, h.end, 'TEST_ONLY');
        expect(h.carries).toHaveLength(1);
        expect(h.carries[0].pairedPv.toString()).toBe(expected);
      }
    });
    it('paired PV deducted from both sides and strong-side carry remains', async () => {
      for (const [left, right, expectedLeft, expectedRight] of [
        ['3000', '1000', '2200', '0'], ['1000', '3000', '0', '1800'],
        ['700000', '600000', '250300', '150100'],
      ]) {
        const h = await binaryHarness(left, right, '300', '100');
        const original = JSON.stringify(h.previous);
        await h.service.settleBinary(h.start, h.end, 'TEST_ONLY');
        expect(h.carries[0].leftCarryOut.toString()).toBe(expectedLeft);
        expect(h.carries[0].rightCarryOut.toString()).toBe(expectedRight);
        expect(JSON.stringify(h.previous)).toBe(original);
        expect(h.tx.binaryCarry.create).toHaveBeenCalledTimes(1);
      }
    });
    it('STARTER/ELITE/LEADER weekly caps 450k/900k/1.5m', async () => {
      for (const [plan, cap, theory] of [['STARTER', '450000', '54000'], ['ELITE', '900000', '108000'], ['LEADER', '1500000', '180000']]) {
        const h = await binaryHarness('2000000', '2000000', '0', '0', plan);
        await h.service.settleBinary(h.start, h.end, 'TEST_ONLY');
        expect(h.carries[0].weeklyCapSnapshot.toString()).toBe(cap);
        expect(h.carries[0].pairedPv.toString()).toBe(cap);
        expect(h.awards[0].planLevelSnapshot).toBe(plan);
        expect(h.awards[0].theoryAmount.toString()).toBe(theory);
      }
    });
    it('Binary theory = paired PV x 12%', async () => {
      const h = await binaryHarness('1234.56', '2345.67');
      await h.service.settleBinary(h.start, h.end, 'TEST_ONLY');
      expect(h.awards).toHaveLength(1);
      expect(h.awards[0].theoryAmount.toString()).toBe('148.1472');
      expect(h.awards[0].calculationDetail.pairedPv).toBe('1234.56');
      expect(h.awards[0].calculationDetail.pairRate).toBe('0.12');
    });
    it('Binary Pool is 36% and K1 <= 1', async () => {
      for (const [incoming, volume, expectedPool, expectedK, payable] of [
        ['0', '1000', '720', '1', '120'],
        ['9000', '1000', '720', '0.6', '720'],
        ['10000', '0', '0', '0', '0'],
      ]) {
        const h = await binaryHarness(volume, volume, incoming, incoming);
        const batch = await h.service.settleBinary(h.start, h.end, 'TEST_ONLY');
        expect(batch.poolRate.toString()).toBe('0.36');
        expect(batch.poolAvailable.toString()).toBe(expectedPool);
        expect(batch.kFactor.toString()).toBe(expectedK);
        expect(h.awards[0].payableAmount.toString()).toBe(payable);
        expect(h.awards[0].kFactor.toString()).toBe(expectedK);
      }
    });
    it('inactive recipient produces zero-entitlement evidence without a Binary award', async () => {
      const h = await binaryHarness('3000', '1000');
      h.tx.activePeriod.findFirst.mockImplementation(async () => null as any);
      const batch = await h.service.settleBinary(h.start, h.end, 'TEST_ONLY');
      expect(h.carries).toHaveLength(1);
      expect(h.carries[0].pairedPv.toString()).toBe('1000');
      expect(h.awards).toEqual([]);
      expect(h.lifecycle).toEqual([]);
      expect(h.evidence).toHaveLength(1);
      expect(h.evidence[0]).toEqual(expect.objectContaining({
        settlementBatchId:'binary',evidenceType:'BINARY_ELIGIBILITY',
        recipientQualificationId:'root',reasonCode:'INACTIVE',ruleVersionCode:'TEST_ONLY'
      }));
      expect(h.evidence[0].theoreticalAmount.toString()).toBe('120');
      expect(h.evidence[0].entitlementAmount.toString()).toBe('0');
      expect(batch.totalTheory.toString()).toBe('0');
      expect(h.tx.bonusAward.create).not.toHaveBeenCalled();
    });
  });

  describe('Matching', () => {
    it('source is actual Binary payable after K1, never Binary theory', async () => {
      for (const theory of ['1000', '9000']) {
        const h = await matchingHarness('1000', '200', theory);
        await h.service.settleMatching(h.start, h.end, 'TEST_ONLY');
        expect(h.awards.map(a => a.theoryAmount.toString())).toEqual(['30', '20', '10', '10', '10']);
        expect(h.awards.every(a => a.sourceAwardId === 'binary-award' && a.calculationDetail.sourceBinaryPaid === '200')).toBe(true);
        expect(h.tx.bonusAward.findMany).toHaveBeenCalledWith({where: {settlementBatchId: 'binary', awardType: 'BINARY'}});
      }
    });
    it('Sponsor Tree is used to trace matching uplines', async () => {
      const h = await matchingHarness('1000', '200');
      await h.service.settleMatching(h.start, h.end, 'TEST_ONLY');
      expect(h.query.sponsorAncestors).toHaveBeenCalledTimes(1);
      expect(h.query.sponsorAncestors).toHaveBeenCalledWith(h.tx, 'binary-recipient', h.end, 5);
      expect(h.awards.map(a => a.recipientQualificationId)).toEqual([
        'sponsor-1', 'sponsor-2', 'sponsor-3', 'sponsor-4', 'sponsor-5',
      ]);
      expect(h.awards.every(a => a.recipientQualificationId !== 'binary-recipient')).toBe(true);
    });
    it('rates are G1=15,G2=10,G3-G5=5', async () => {
      const h = await matchingHarness('1000', '100');
      await h.service.settleMatching(h.start, h.end, 'TEST_ONLY');
      expect(h.awards.map(a => [a.generationNo, a.recipientQualificationId, a.theoryAmount.toString()])).toEqual([
        [1, 'sponsor-1', '15'], [2, 'sponsor-2', '10'], [3, 'sponsor-3', '5'], [4, 'sponsor-4', '5'], [5, 'sponsor-5', '5'],
      ]);
    });
    it('direct 1 unlocks G1-G2, 2 unlocks G1-G3, 3 unlocks G1-G4, 4+ unlocks G1-G5',()=>{
      const service=new BinaryBonusService({} as any,{} as any,{} as any,{} as any);
      expect([0,1,2,3,4,8].map(d=>service.matchingUnlockDepth(d))).toEqual([0,2,3,4,5,5]);
    });
    it('inactive or locked intermediate generation records zero evidence and does not compress later generations', async () => {
      for (const reason of ['inactive','locked'] as const) {
        const h = await matchingHarness('1000','100');
        if (reason === 'inactive') (h.query.isActiveAt as jest.Mock).mockImplementation(async (_tx:any,id:string) => id !== 'sponsor-2');
        else (h.query.effectiveDirectCountAt as jest.Mock).mockImplementation(async (_tx:any,id:string) => id === 'sponsor-2' ? 0 : 4);
        await h.service.settleMatching(h.start,h.end,'TEST_ONLY');
        expect(h.awards.map(a => [a.generationNo,a.recipientQualificationId,a.theoryAmount.toString()])).toEqual([
          [1,'sponsor-1','15'],[3,'sponsor-3','5'],[4,'sponsor-4','5'],[5,'sponsor-5','5'],
        ]);
        expect(h.evidence).toHaveLength(1);
        expect(h.evidence[0]).toEqual(expect.objectContaining({
          evidenceType:'BINARY_MATCHING_ELIGIBILITY',recipientQualificationId:'sponsor-2',reasonCode:reason === 'inactive' ? 'INACTIVE' : 'LOCKED'
        }));
        expect(h.evidence[0].theoreticalAmount.toString()).toBe('10');
        expect(h.evidence[0].entitlementAmount.toString()).toBe('0');
      }
    });
    it('Matching Pool is 15% and K2 <= 1', async () => {
      for (const [volume, expectedPool, expectedK, expectedPayables] of [
        ['1000', '150', '1', ['30', '20', '10', '10', '10']],
        ['160', '24', '0.3', ['9', '6', '3', '3', '3']],
        ['0', '0', '0', ['0', '0', '0', '0', '0']],
      ] as const) {
        const h = await matchingHarness(volume);
        const batch = await h.service.settleMatching(h.start, h.end, 'TEST_ONLY');
        expect(batch.poolAvailable.toString()).toBe(expectedPool);
        expect(batch.poolRate.toString()).toBe('0.15');
        expect(batch.kFactor.toString()).toBe(expectedK);
        expect(h.awards.map(a => a.payableAmount.toString())).toEqual([...expectedPayables]);
        expect(h.awards.reduce((sum, a) => sum.add(a.payableAmount), new Prisma.Decimal(0)).lte(batch.poolAvailable)).toBe(true);
        expect(h.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
      }
    });
  });

  describe('Lifecycle', () => {
    it('award creates CALCULATED then PENDING_45D events', async () => {
      const referral = await referralHarness(), binary = await binaryHarness(), matching = await matchingHarness();
      await referral.service.settle(referral.start, referral.end, 'TEST_ONLY');
      await binary.service.settleBinary(binary.start, binary.end, 'TEST_ONLY');
      await matching.service.settleMatching(matching.start, matching.end, 'TEST_ONLY');
      for (const h of [referral, binary, matching]) {
        expect(h.awards.length).toBeGreaterThan(0);
        expect(h.lifecycle).toHaveLength(h.awards.length * 2);
        for (const award of h.awards) {
          expect(h.lifecycle.filter(event => event.bonusAwardId === award.bonusAwardId).map(event => event.status)).toEqual(['CALCULATED', 'PENDING_45D']);
          expect(award.pendingUntil.toISOString()).toBe(award.awardType === 'BINARY' || award.awardType === 'MATCHING' ? '2020-02-22T00:00:00.000Z' : '2020-02-16T00:00:00.000Z');
        }
      }
    });
    it('after pending_until latest status becomes EFFECTIVE',async()=>{
      const {service,prisma,tx,events,pendingUntil}=lifecycleHarness();
      expect(await service.matureDueAwards(new Date(pendingUntil.getTime()-1))).toEqual({matured:0});
      expect(tx.bonusAwardLifecycleEvent.create).not.toHaveBeenCalled();
      expect(await service.matureDueAwards(pendingUntil)).toEqual({matured:1});
      expect(events.map(event=>event.status)).toEqual(['PENDING_45D','EFFECTIVE']);
      expect(prisma.bonusAward.findMany).toHaveBeenCalledWith({where:{pendingUntil:{lte:pendingUntil}},take:500});
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(await service.matureDueAwards(pendingUntil)).toEqual({matured:0});
      expect(tx.bonusAwardLifecycleEvent.create).toHaveBeenCalledTimes(1);
    });
    it('award row itself remains append-only',async()=>{
      const {service,tx,award,pendingUntil,events}=lifecycleHarness(),original=JSON.stringify(award);
      await service.matureDueAwards(pendingUntil);
      expect(JSON.stringify(award)).toBe(original);
      expect(tx.bonusAward.update).not.toHaveBeenCalled();
      expect(tx.bonusAward.delete).not.toHaveBeenCalled();
      events.push({status:'PAID',occurredAt:new Date('2020-02-02')});
      expect(await service.matureDueAwards(new Date('2020-02-03'))).toEqual({matured:0});
      expect(tx.bonusAwardLifecycleEvent.create).toHaveBeenCalledTimes(1);
    });
  });
});
