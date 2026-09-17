import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Prisma, PrismaService, replayHash, taipeiMonth } from '@ucell/database';
import { MemberExplainController } from '../src/modules/member/member-explain.controller';
import { MemberExplainService } from '../src/modules/member/member-explain.service';
import { MemberAuthenticationGuard } from '../src/modules/auth/member-authentication.guard';
import { MemberContextGuard } from '../src/modules/member/member-context.guard';
import { QualificationAccessService } from '../src/modules/auth/qualification-access.service';
import { IdentityTokenService } from '../src/modules/auth/identity-token.service';
import { LineIdentityService } from '../src/modules/auth/line-identity.service';
import { EnvelopeInterceptor } from '../src/common/interceptors/envelope.interceptor';

const qid = '11111111-1111-4111-8111-111111111111', pid = '22222222-2222-4222-8222-222222222222';
const sid = '33333333-3333-4333-8333-333333333333', bid = '44444444-4444-4444-8444-444444444444';
const other = '55555555-5555-4555-8555-555555555555';
const flatHash = (value: Record<string, unknown>) => createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex');
function fixture() {
  const now = new Date(), month = taipeiMonth(now), dec = (v: string) => new Prisma.Decimal(v);
  const recognition: any = { consumptionRecognitionEventId: 'recognition-1', qualificationId: qid, sourceType: 'ORDER_PAYMENT', sourceId: 'order-1', sourceLineId: null,
    direction: 'ORIGINAL', reversalOfEventId: null, createdAt: month.start, eligible: true, eligibleAmount: dec('2000'), recognitionPurpose: 'GPV', recognizedAt: month.start, recognitionMonth: month.calendarMonth,
    parameterSnapshotHash: 'a'.repeat(64), ruleVersionCode: 'R1.0B' };
  recognition.evidenceHash = flatHash({ qualificationId: qid, sourceType: recognition.sourceType, sourceId: recognition.sourceId, sourceLineId: null,
    eligible: true, eligibleAmount: '2000', purpose: 'GPV', recognizedAt: month.start.toISOString(), month: month.key });
  const accumulator: any = { qualificationMonthAccumulatorEvidenceId: 'accumulator-1', consumptionRecognitionEventId: 'recognition-1', qualificationId: qid,
    calendarMonth: month.calendarMonth, cumulativeBefore: dec('0'), eligibleDelta: dec('2000'), cumulativeAfter: dec('2000'), activeThreshold: dec('2000'),
    sequenceNo: 1, recordedAt: month.start, thresholdCrossed: true, ruleVersionCode: 'R1.0B', replayRunId: null };
  accumulator.evidenceHash = flatHash({ recognitionId: 'recognition-1', before: '0', delta: '2000', after: '2000', threshold: '2000' });
  const interval: any = { activeIntervalEvidenceId: 'interval-1', qualificationId: qid, sourceAccumulatorEvidenceId: 'accumulator-1', calendarMonth: month.calendarMonth,
    activeFrom: month.start, activeTo: month.end, createdAt: month.start, ruleVersionCode: 'R1.0B', replayRunId: null, supersedesActiveEvidenceId: null,
    reasonCode: 'MONTHLY_ELIGIBLE_CONSUMPTION_THRESHOLD' };
  interval.evidenceHash = flatHash({ accumulatorId: 'accumulator-1', from: month.start.toISOString(), to: month.end.toISOString() });
  const period = { sourceType: 'CONSUMPTION_RECOGNITION', sourceId: 'interval-1', activeFrom: month.start, activeTo: month.end, ruleVersionCode: 'R1.0B' };
  const parameterBody = { format: 'UCELL_PARAMETER_SNAPSHOT_V1', ruleVersionCode: 'R1.0B', effectiveAt: month.start.toISOString(), parameters: [] };
  const parameters = { ...parameterBody, hash: replayHash(parameterBody) };
  const content: any = { format: 'UCELL_HISTORICAL_REPLAY_V1', kind: 'BINARY_K1', sourceId: bid, at: month.start.toISOString(),
    ruleVersionCode: 'R1.0B', parameters, recipients: [], inputs: { periodStart: month.start.toISOString(), periodEnd: month.end.toISOString() },
    evidence: { carryRecipients: [{ qualificationId: qid, leftCarryOut: '9007199254740993.1234', rightCarryOut: '0.0000' },
      { qualificationId: other, leftCarryOut: '999999.9', rightCarryOut: '888888.8' }] } };
  const snapshot = { snapshotId: 'snapshot-1', content, hash: replayHash(content), ruleVersionCode: 'R1.0B' };
  const batch: any = { settlementBatchId: bid, settlementType: 'BINARY_K1', status: 'FINALIZED', finalizedAt: now,
    calculationHash: 'b'.repeat(64), periodStart: month.start, periodEnd: month.end, ruleVersionCode: 'R1.0B' };
  const session: any = { authSessionId: sid, personId: pid, provider: 'LINE', subject: 'line-subject', status: 'ACTIVE', roleCode: null,
    expiresAt: new Date(now.getTime() + 60000), revokedAt: null };
  const db: any = {
    authSession: { findUnique: jest.fn(async () => session) }, person: { findUnique: jest.fn(async () => ({ status: 'EFFECTIVE' })) },
    identityLink: { findUnique: jest.fn(async () => ({ personId: pid })) },
    qualification: { findUnique: jest.fn(async (input: any) => input.where.qualificationId === qid ? { currentHolderPersonId: pid } : null) },
    qualificationHolderHistory: {
      findMany: jest.fn(async (input: any) => input.where.qualificationId === qid ? [{ holderPersonId: pid }] : []),
      findFirst: jest.fn(async (input: any) => input.where.qualificationId === qid ? { holderPersonId: pid } : null),
    },
    systemAssignmentPoolEntry: { findFirst: jest.fn(async () => null) },
    activeIntervalEvidence: { findMany: jest.fn(async () => [interval]) },
    qualificationMonthAccumulatorEvidence: { findUnique: jest.fn(async () => accumulator), findFirst: jest.fn(async () => null) },
    consumptionRecognitionEvent: { findUnique: jest.fn(async () => recognition), findFirst: jest.fn(async () => null) },
    activePeriod: { findMany: jest.fn(async () => [period]) },
    settlementBatch: { findUnique: jest.fn(async (input: any) => input.where.settlementBatchId === bid ? batch : null) },
    historicalReplaySnapshot: { findUnique: jest.fn(async () => snapshot) },
    auditEvent: { create: jest.fn(async () => ({})) },
  };
  db.$transaction = jest.fn(async (work: any) => work(db));
  return { db, interval, accumulator, recognition, period, batch, snapshot, session };
}

describe('Member Explain HTTP adapters', () => {
  let app: NestFastifyApplication; let data: ReturnType<typeof fixture>;
  const headers = { authorization: 'Bearer synthetic-token' };
  beforeEach(async () => {
    data = fixture();
    const module = await Test.createTestingModule({ controllers: [MemberExplainController],
      providers: [MemberExplainService, MemberAuthenticationGuard, MemberContextGuard, QualificationAccessService,
        { provide: PrismaService, useValue: data.db },
        { provide: IdentityTokenService, useValue: { authenticate: jest.fn(async () => ({ sessionId: sid, personId: pid, provider: 'LINE', subject: 'line-subject', role: null })) } },
        { provide: LineIdentityService, useValue: { resolveVerifiedSubject: jest.fn(async () => ({ provider: 'LINE', providerSubject: 'line-subject', personId: pid })) } },
      ] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api/v1'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new EnvelopeInterceptor()); await app.init(); await app.getHttpAdapter().getInstance().ready();
  });
  afterEach(async () => { await app?.close(); });
  const activeUrl = '/api/v1/member/explain/active?qualificationId=' + qid;
  const carryUrl = '/api/v1/member/explain/binary-carry?qualificationId=' + qid + '&settlementBatchId=' + bid;

  it('requires actual Member authentication', async () => {
    const response = await app.inject({ method: 'GET', url: activeUrl }); expect(response.statusCode).toBe(401);
    expect(data.db.activeIntervalEvidence.findMany).not.toHaveBeenCalled();
  });
  it('returns verified current Active with safe evidence references', async () => {
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ classification: 'MEMBER_SELF', result: { active: true, ownerType: 'MEMBER', reasonCode: 'THRESHOLD_MET' } });
    expect(response.json().data.evidenceRefs).toHaveLength(3);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).not.toMatch(/line-subject|tokenHash|sourceLineId|sourceId/);
    expect(data.db.authSession.findUnique).toHaveBeenCalledTimes(2);
    expect(data.db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'MEMBER_EXPLAIN_READ' }) }));
  });
  it('returns exact sealed Carry strings without another recipient or invented tree', async () => {
    const response = await app.inject({ method: 'GET', url: carryUrl, headers }); expect(response.statusCode).toBe(200);
    expect(response.json().data.result).toEqual({ leftCarry: '9007199254740993.1234', rightCarry: '0.0000' });
    expect(response.json().data.scope).toEqual({ qualificationId: qid, settlementBatchId: bid });
    expect(response.body).not.toContain(other); expect(response.body).not.toContain('binaryTreeId');
    expect(data.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead', maxWait: 500, timeout: 1500 });
  });
  it.each(['roles=ADMIN', 'asOf=2020-01-01', 'sql=SELECT', 'binaryTreeId=other'])('rejects unsupported query %s', async extra => {
    const response = await app.inject({ method: 'GET', url: activeUrl + '&' + extra, headers }); expect(response.statusCode).toBe(400);
    expect(data.db.activeIntervalEvidence.findMany).not.toHaveBeenCalled();
  });
  it('denies another Ball before reading evidence', async () => {
    const response = await app.inject({ method: 'GET', url: activeUrl.replace(qid, other), headers }); expect(response.statusCode).toBe(403);
    expect(data.db.activeIntervalEvidence.findMany).not.toHaveBeenCalled();
  });
  it('denies overlapping holder evidence even if one row is owned', async () => {
    data.db.qualificationHolderHistory.findMany.mockResolvedValue([{ holderPersonId: pid }, { holderPersonId: other }]);
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(403);
  });
  it('denies a system-designated Ball in this Member-only adapter', async () => {
    data.db.systemAssignmentPoolEntry.findFirst.mockResolvedValue({ qualificationId: qid });
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(403);
  });
  it('suppresses response when the session is revoked during read', async () => {
    data.db.activeIntervalEvidence.findMany.mockImplementation(async () => { data.session.status = 'REVOKED'; return [data.interval]; });
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(403); expect(response.body).not.toContain('THRESHOLD_MET');
  });
  it('suppresses response when ownership changes after the transaction read', async () => {
    data.db.qualificationHolderHistory.findMany.mockResolvedValueOnce([{ holderPersonId: pid }]).mockResolvedValueOnce([{ holderPersonId: pid }]).mockResolvedValueOnce([]);
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(403);
  });
  it('does not infer inactive from missing Active evidence', async () => {
    data.db.activeIntervalEvidence.findMany.mockResolvedValue([]);
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(422); expect(response.body).toContain('HISTORICAL_UNAVAILABLE');
  });
  it('rejects unreviewed threshold evidence instead of recalculating it', async () => {
    data.accumulator.activeThreshold = new Prisma.Decimal('1200');
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(422);
  });
  it('fails closed for tampered Active hash', async () => {
    data.interval.evidenceHash = 'f'.repeat(64);
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(503); expect(response.body).toContain('INVALID_EVIDENCE');
  });
  it('fails closed for replayed Active interval not yet supported by adapter', async () => {
    data.interval.replayRunId = 'replay-1';
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(422);
  });
  it('does not claim current Active when another accumulator revision was replayed', async () => {
    data.db.qualificationMonthAccumulatorEvidence.findFirst.mockResolvedValue({ qualificationMonthAccumulatorEvidenceId: 'replayed-accumulator' });
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(422);
  });
  function belowThreshold(amount = '1999.9999', eligible = true) {
    const { accumulator: a, recognition: r, db } = data;
    a.eligibleDelta = a.cumulativeAfter = new Prisma.Decimal(amount); a.thresholdCrossed = false;
    r.eligibleAmount = new Prisma.Decimal(amount); r.eligible = eligible;
    a.evidenceHash = flatHash({ recognitionId: r.consumptionRecognitionEventId, before: '0', delta: amount, after: amount, threshold: '2000' });
    r.evidenceHash = flatHash({ qualificationId: qid, sourceType: r.sourceType, sourceId: r.sourceId, sourceLineId: r.sourceLineId,
      eligible, eligibleAmount: amount, purpose: r.recognitionPurpose, recognizedAt: r.recognizedAt.toISOString(), month: taipeiMonth(r.recognizedAt).key });
    db.activeIntervalEvidence.findMany.mockResolvedValue([]); db.activePeriod.findMany.mockResolvedValue([]);
    db.qualificationMonthAccumulatorEvidence.findFirst.mockImplementation(async (query: any) => query.where.replayRunId ? null : a);
  }
  it.each([['1999.9999', true], ['0', false]])('explains persisted below-threshold evidence (%s, eligible=%s)', async (amount, eligible) => {
    belowThreshold(amount as string, eligible as boolean);
    const response = await app.inject({ method: 'GET', url: activeUrl, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.result).toEqual({ active: false, ownerType: 'MEMBER', reasonCode: 'BELOW_THRESHOLD' });
    expect(response.json().data.evidenceRefs).toHaveLength(2);
    expect(response.json().data.updatedAt).toBe(data.accumulator.recordedAt.toISOString());
    expect(data.db.qualificationMonthAccumulatorEvidence.findFirst).toHaveBeenCalledWith({
      where: { qualificationId: qid, calendarMonth: data.accumulator.calendarMonth }, orderBy: { sequenceNo: 'desc' },
    });
    expect(response.headers['cache-control']).toBe('no-store'); expect(data.db.auditEvent.create).toHaveBeenCalled();
  });
  it.each(['threshold', 'later-above-threshold', 'future', 'replay', 'correction', 'active-period', 'wrong-ball', 'wrong-month', 'recognition-future'])(
    'does not claim inactive for conflicting or unsupported evidence: %s', async kind => {
      belowThreshold();
      if (kind === 'threshold') data.accumulator.activeThreshold = new Prisma.Decimal('1200');
      if (kind === 'later-above-threshold') data.accumulator.cumulativeAfter = new Prisma.Decimal('2001');
      if (kind === 'future') data.accumulator.recordedAt = new Date(Date.now() + 60000);
      if (kind === 'replay') data.accumulator.replayRunId = 'replay-1';
      if (kind === 'correction') data.db.consumptionRecognitionEvent.findFirst.mockResolvedValue({ consumptionRecognitionEventId: 'correction-1' });
      if (kind === 'active-period') data.db.activePeriod.findMany.mockResolvedValue([data.period]);
      if (kind === 'wrong-ball') data.recognition.qualificationId = other;
      if (kind === 'wrong-month') data.accumulator.calendarMonth = new Date('2000-01-01T00:00:00Z');
      if (kind === 'recognition-future') data.recognition.recognizedAt = new Date(Date.now() + 60000);
      const response = await app.inject({ method: 'GET', url: activeUrl, headers });
      expect(response.statusCode).toBe(422); expect(response.body).not.toContain('BELOW_THRESHOLD');
    });
  it.each(['accumulator', 'recognition'])('rejects tampered below-threshold %s evidence', async kind => {
    belowThreshold(); data[kind as 'accumulator' | 'recognition'].evidenceHash = 'f'.repeat(64);
    const response = await app.inject({ method: 'GET', url: activeUrl, headers });
    expect(response.statusCode).toBe(503); expect(response.body).toContain('INVALID_EVIDENCE');
  });
  it('does not interpret thresholdCrossed=false as inactive after a prior crossing', async () => {
    belowThreshold('2500');
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(422);
  });
  it('requires a stored accumulator even when no current ActivePeriod exists', async () => {
    belowThreshold(); data.db.qualificationMonthAccumulatorEvidence.findFirst.mockResolvedValue(null);
    const response = await app.inject({ method: 'GET', url: activeUrl, headers }); expect(response.statusCode).toBe(422);
  });
  it('never reads Carry from a draft settlement', async () => {
    data.batch.status = 'DRAFT';
    const response = await app.inject({ method: 'GET', url: carryUrl, headers }); expect(response.statusCode).toBe(422);
    expect(data.db.historicalReplaySnapshot.findUnique).not.toHaveBeenCalled();
  });
  it('rejects a tampered sealed snapshot', async () => {
    data.snapshot.hash = 'f'.repeat(64);
    const response = await app.inject({ method: 'GET', url: carryUrl, headers }); expect(response.statusCode).toBe(503);
  });
  it('requires unique Carry evidence for the selected Ball', async () => {
    data.snapshot.content.evidence.carryRecipients.push(data.snapshot.content.evidence.carryRecipients[0]); data.snapshot.hash = replayHash(data.snapshot.content);
    const response = await app.inject({ method: 'GET', url: carryUrl, headers }); expect(response.statusCode).toBe(422);
  });
  it('does not coerce numeric/null Carry evidence into a decimal string', async () => {
    data.snapshot.content.evidence.carryRecipients[0].leftCarryOut = null; data.snapshot.hash = replayHash(data.snapshot.content);
    const response = await app.inject({ method: 'GET', url: carryUrl, headers }); expect(response.statusCode).toBe(503);
  });
  it('does not release evidence when audit persistence fails', async () => {
    data.db.auditEvent.create.mockRejectedValue(new Error('audit credentials must not leak'));
    const response = await app.inject({ method: 'GET', url: carryUrl, headers }); expect(response.statusCode).toBe(503); expect(response.body).not.toContain('credentials');
  });
});
