import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const url = new URL(process.env.DATABASE_URL ?? '');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Only local isolated databases allowed');
assert.match(url.pathname, /^\/ucell_explain_[a-f0-9]{32}$/, 'Run through member-explain-db-isolated.mjs');
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { recognizeConsumption, taipeiMonth } = require(fileURLToPath(new URL('../packages/database/dist/index.js', import.meta.url)));
const { readMemberActiveEvidence } = require(fileURLToPath(new URL('../apps/api/dist/modules/member/member-explain-source.js', import.meta.url)));
const db = new PrismaClient();
let assertions = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; };
const read = (qualificationId, now = new Date()) => db.$transaction(
  tx => readMemberActiveEvidence(tx, qualificationId, now),
  { isolationLevel: 'RepeatableRead', maxWait: 500, timeout: 1500 },
);
async function unavailable(qualificationId, code = 'HISTORICAL_UNAVAILABLE', now) {
  await assert.rejects(() => read(qualificationId, now), error => error.code === code);
  assertions++;
}
async function ball() {
  const person = await db.person.create({ data: { legalName: 'TEST ONLY Member Explain', status: 'EFFECTIVE', membershipState: 'NETWORK_MEMBER' } });
  return (await db.qualification.create({ data: { currentHolderPersonId: person.personId,
    planLevelCode: 'LEADER', status: 'EFFECTIVE', effectiveAt: new Date() } })).qualificationId;
}
const recognize = (qualificationId, amount, extra = {}) => db.$transaction(tx => recognizeConsumption(tx, {
  qualificationId, sourceType: 'TEST_ONLY_MEMBER_EXPLAIN', sourceId: randomUUID(), amount, eligible: true,
  concreteVolumeType: 'GPV', productProfileVersion: 'TEST_ONLY', ruleVersionCode: 'R1.0B',
  parameterSnapshotHash: 'a'.repeat(64), recognizedAt: taipeiMonth(new Date()).start, activeThreshold: '2000', ...extra,
}), { isolationLevel: 'Serializable' });
try {
  const qid = await ball();
  await unavailable(qid);
  const zero = await recognize(qid, '100', { eligible: false, exclusionReasonCode: 'TEST_EXCLUDED' });
  let result = await read(qid);
  eq(result.result, { active: false, ownerType: 'MEMBER', reasonCode: 'BELOW_THRESHOLD' }, 'excluded consumption produces verified zero');
  eq(result.evidenceRefs[0].id, zero.accumulator.qualificationMonthAccumulatorEvidenceId, 'original accumulator reference');

  const below = await recognize(qid, '1999.9999');
  result = await read(qid);
  eq(result.result.active, false, 'four-decimal precision immediately below threshold');
  eq(result.evidenceRefs[0].id, below.accumulator.qualificationMonthAccumulatorEvidenceId, 'latest sequence selected');
  await assert.rejects(() => db.qualificationMonthAccumulatorEvidence.update({ where: {
    qualificationMonthAccumulatorEvidenceId: zero.accumulator.qualificationMonthAccumulatorEvidenceId,
  }, data: { recordedAt: new Date() } }), /append-only/);
  assertions++;
  eq((await read(qid)).evidenceRefs[0].id, below.accumulator.qualificationMonthAccumulatorEvidenceId, 'rejected mutation leaves latest evidence unchanged');
  const crossed = await recognize(qid, '0.0001');
  result = await read(qid);
  eq(result.result, { active: true, ownerType: 'MEMBER', reasonCode: 'THRESHOLD_MET' }, 'exact 2000 crosses threshold');
  eq(result.evidenceRefs.length, 3, 'active interval plus accumulator and recognition references');
  eq(result.evidenceRefs[1].id, crossed.accumulator.qualificationMonthAccumulatorEvidenceId, 'crossing accumulator selected');
  const after = await recognize(qid, '1');
  eq(after.accumulator.thresholdCrossed, false, 'subsequent event does not cross again');
  eq((await read(qid)).result.active, true, 'false crossing flag does not deactivate an already-active Ball');
  await unavailable(qid, 'HISTORICAL_UNAVAILABLE', taipeiMonth(new Date()).end);
  await unavailable(await ball());

  const corrupt = await ball();
  const original = await recognize(corrupt, '10');
  await db.qualificationMonthAccumulatorEvidence.create({ data: { ...original.accumulator,
    qualificationMonthAccumulatorEvidenceId: randomUUID(), idempotencyKey: randomUUID(), sequenceNo: 2,
    evidenceHash: 'f'.repeat(64) } });
  await unavailable(corrupt, 'INVALID_EVIDENCE');

  const replayed = await ball();
  const replaySource = await recognize(replayed, '10');
  const order = await db.order.create({ data: { qualificationId: replayed, grossAmount: '10', netAmount: '10', ruleVersionCode: 'R1.0B' } });
  const returned = await db.returnCase.create({ data: { orderId: order.orderId, reasonCode: 'TEST_ONLY', occurredAt: new Date(),
    idempotencyKey: randomUUID(), correlationId: randomUUID() } });
  const month = taipeiMonth(new Date());
  const run = await db.settlementReplayRun.create({ data: { sourceReturnCaseId: returned.returnCaseId,
    initialPeriodStart: month.start, initialPeriodEnd: month.end, ruleVersionCode: 'R1.0B', calculationSnapshot: {} } });
  await db.qualificationMonthAccumulatorEvidence.create({ data: { ...replaySource.accumulator,
    qualificationMonthAccumulatorEvidenceId: randomUUID(), idempotencyKey: randomUUID(), sequenceNo: 2,
    replayRunId: run.settlementReplayRunId } });
  await unavailable(replayed);

  const corrected = await ball();
  const correctionSource = await recognize(corrected, '10');
  await db.consumptionRecognitionEvent.create({ data: { ...correctionSource.recognition,
    consumptionRecognitionEventId: randomUUID(), idempotencyKey: randomUUID(), direction: 'REVERSAL',
    eligibleAmount: '-10', reversalOfEventId: correctionSource.recognition.consumptionRecognitionEventId } });
  await unavailable(corrected);
  const conflicting = await ball();
  await recognize(conflicting, '10');
  await db.activePeriod.create({ data: { qualificationId: conflicting, activeFrom: taipeiMonth(new Date()).start,
    activeTo: taipeiMonth(new Date()).end, sourceType: 'TEST_ONLY_CONFLICT', ruleVersionCode: 'R1.0B' } });
  await unavailable(conflicting);

  const future = await ball();
  await recognize(future, '10', { recognizedAt: new Date(Date.now() + 60000) });
  await unavailable(future);

  const unsupported = await ball();
  await recognize(unsupported, '10', { activeThreshold: '1200' });
  await unavailable(unsupported);

  const evidenceBefore = JSON.stringify(await db.qualificationMonthAccumulatorEvidence.findMany({ where: { qualificationId: qid } }));
  await read(qid);
  eq(JSON.stringify(await db.qualificationMonthAccumulatorEvidence.findMany({ where: { qualificationId: qid } })), evidenceBefore, 'read leaves stored accumulation unchanged');
  console.log('MEMBER_EXPLAIN_DB_PASS: ' + assertions + ' assertions; real migrated PostgreSQL and production recognition writer');
} finally { await db.$disconnect(); }
