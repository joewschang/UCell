import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { replayHash, storeReplaySnapshot } = require('@ucell/database');

/** Uses only the parent suite's guarded temporary database and authenticated HTTP client. */
export async function verifyCarryHttp({ db, qid, foreign, request, eq, audits }) {
  const periodStart = new Date('2026-08-31T16:00:00.000Z');
  const periodEnd = new Date('2026-09-07T16:00:00.000Z');
  const row = { qualificationId: qid, leftCarryOut: '9007199254740993.1234', rightCarryOut: '0.0000' };
  async function fixture({ status = 'FINALIZED', recipients = [row, { qualificationId: foreign, leftCarryOut: '999', rightCarryOut: '888' }],
    missing = false, corrupt = false } = {}) {
    const ruleVersionCode = 'TEST_ONLY_CARRY_HTTP_' + randomUUID();
    const body = { format: 'UCELL_PARAMETER_SNAPSHOT_V1', ruleVersionCode, effectiveAt: periodEnd.toISOString(), parameters: [] };
    const parameters = { ...body, hash: replayHash(body) };
    const batch = await db.settlementBatch.create({ data: { settlementType: 'BINARY_K1', periodStart, periodEnd,
      ruleVersionCode, status, parameterSnapshot: parameters, totalGpv: '2200', poolRate: '0.36', poolAvailable: '792',
      totalTheory: '100', kFactor: '1', calculationHash: 'b'.repeat(64),
      finalizedAt: status === 'FINALIZED' ? new Date('2026-09-07T16:01:00.000Z') : null } });
    const content = { format: 'UCELL_HISTORICAL_REPLAY_V1', kind: 'BINARY_K1', sourceId: batch.settlementBatchId,
      at: periodEnd.toISOString(), ruleVersionCode, parameters, recipients: [],
      evidence: { carryRecipients: recipients }, inputs: { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() } };
    let snapshot;
    if (!missing) {
      snapshot = corrupt
        ? await db.historicalReplaySnapshot.create({ data: { kind: 'BINARY_K1', sourceId: batch.settlementBatchId, ruleVersionCode, content, hash: 'f'.repeat(64) } })
        : await db.$transaction(tx => storeReplaySnapshot(tx, content));
    }
    return { batch, snapshot, parameters };
  }
  const url = id => '/api/v1/member/explain/binary-carry?qualificationId=' + qid + '&settlementBatchId=' + id;
  const valid = await fixture();
  let response = await request(url(valid.batch.settlementBatchId));
  eq(response.statusCode, 200, 'sealed Carry available through real HTTP and database');
  const data = response.json().data;
  eq(data.result, { leftCarry: row.leftCarryOut, rightCarry: row.rightCarryOut }, 'large decimal strings and trailing zeros preserved');
  eq(data.scope, { qualificationId: qid, settlementBatchId: valid.batch.settlementBatchId }, 'Carry scope names original batch');
  eq(data.finality, 'FINALIZED', 'Carry is final');
  eq(data.periodEnd, periodEnd.toISOString(), 'sealed period end');
  eq(data.parameterVersion, valid.parameters.hash, 'sealed parameter version');
  eq(data.evidenceRefs, [
    { type: 'SettlementBatch', id: valid.batch.settlementBatchId, revision: valid.batch.calculationHash },
    { type: 'HistoricalReplaySnapshot', id: valid.snapshot.snapshotId, revision: valid.snapshot.hash },
  ], 'exact source revisions');
  eq(response.headers['cache-control'], 'no-store', 'Carry no-store');
  eq(response.body.includes(foreign), false, 'other recipient omitted');
  eq(response.body.includes('binaryTreeId'), false, 'no invented tree identity');
  const event = (await audits()).at(-1);
  eq(event.afterData.tool, 'explainBinarySettlementCarry', 'Carry audit tool');
  eq(event.afterData.outcome, 'AVAILABLE', 'Carry success audited');
  eq(Object.keys(event.afterData).sort(), ['definitionVersion', 'outcome', 'tool'], 'Carry values absent from audit payload');
  eq((await request(url(valid.batch.settlementBatchId).replace(qid, foreign))).statusCode, 403, 'Carry foreign Ball denied');
  eq((await request(url(valid.batch.settlementBatchId) + '&binaryTreeId=' + randomUUID())).statusCode, 400, 'unsupported tree query rejected');
  eq((await request('/api/v1/member/explain/binary-carry?qualificationId=' + qid)).statusCode, 400, 'batch identifier required');
  for (const [label, options, status, code] of [
    ['draft', { status: 'DRAFT' }, 422, 'HISTORICAL_UNAVAILABLE'],
    ['missing snapshot', { missing: true }, 422, 'HISTORICAL_UNAVAILABLE'],
    ['missing recipient', { recipients: [] }, 422, 'HISTORICAL_UNAVAILABLE'],
    ['duplicate recipient', { recipients: [row, row] }, 422, 'HISTORICAL_UNAVAILABLE'],
    ['corrupt snapshot', { corrupt: true }, 503, 'INVALID_EVIDENCE'],
    ['numeric decimal', { recipients: [{ ...row, leftCarryOut: 123 }] }, 503, 'INVALID_EVIDENCE'],
  ]) {
    const source = await fixture(options);
    response = await request(url(source.batch.settlementBatchId));
    eq(response.statusCode, status, label + ' fails closed');
    assert.ok(response.body.includes(code), label + ' error code');
    eq((await audits()).at(-1).afterData.outcome, code, label + ' failure audited');
    eq(response.body.includes(row.leftCarryOut), false, label + ' has no Carry fallback');
  }
  eq((await request(url(randomUUID()))).statusCode, 422, 'unknown batch does not select another batch');
  eq(await db.historicalReplaySnapshot.findUnique({ where: { snapshotId: valid.snapshot.snapshotId } }),
    valid.snapshot, 'sealed snapshot unchanged by HTTP reads');
}
