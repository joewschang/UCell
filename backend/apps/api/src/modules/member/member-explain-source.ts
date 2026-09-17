import { createHash } from 'node:crypto';
import { Prisma, verifyReplayEnvelope, taipeiMonth } from '@ucell/database';
import { ReadContractError, SourceRead } from '@ucell/shared';

const unavailable = (): never => { throw new ReadContractError('HISTORICAL_UNAVAILABLE'); };
const invalid = (): never => { throw new ReadContractError('INVALID_EVIDENCE'); };
const hash = (value: Record<string, unknown>) => createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex');
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sameDate = (a: Date, b: Date) => a instanceof Date && b instanceof Date && a.getTime() === b.getTime();

/** Only evidence-backed current positive Active is available in this first adapter. */
export async function readMemberActiveEvidence(tx: Prisma.TransactionClient, qualificationId: string, now: Date): Promise<SourceRead> {
  const month = taipeiMonth(now);
  const rows = await tx.activeIntervalEvidence.findMany({ where: { qualificationId, calendarMonth: month.calendarMonth },
    orderBy: [{ createdAt: 'desc' }, { activeIntervalEvidenceId: 'desc' }], take: 2 });
  const interval = rows[0];
  if (!interval || interval.replayRunId || interval.supersedesActiveEvidenceId || interval.activeFrom > now || interval.activeTo <= now) return unavailable();
  if (rows[1] && sameDate(rows[1].createdAt, interval.createdAt)) return unavailable();
  if (interval.ruleVersionCode !== 'R1.0B') return unavailable();
  // A month containing replayed accumulator evidence needs the future replay-aware adapter.
  const replayed = await tx.qualificationMonthAccumulatorEvidence.findFirst({ where: { qualificationId,
    calendarMonth: month.calendarMonth, replayRunId: { not: null } }, select: { qualificationMonthAccumulatorEvidenceId: true } });
  if (replayed) return unavailable();
  const accumulator = await tx.qualificationMonthAccumulatorEvidence.findUnique({ where: { qualificationMonthAccumulatorEvidenceId: interval.sourceAccumulatorEvidenceId } });
  if (!accumulator || accumulator.replayRunId || accumulator.qualificationId !== qualificationId
    || !sameDate(accumulator.calendarMonth, month.calendarMonth) || !accumulator.thresholdCrossed
    || accumulator.activeThreshold.toString() !== '2000' || accumulator.ruleVersionCode !== interval.ruleVersionCode) return unavailable();
  const recognition = await tx.consumptionRecognitionEvent.findUnique({ where: { consumptionRecognitionEventId: accumulator.consumptionRecognitionEventId } });
  if (!recognition || recognition.qualificationId !== qualificationId || !recognition.eligible
    || recognition.ruleVersionCode !== interval.ruleVersionCode || !sameDate(recognition.recognitionMonth, month.calendarMonth)
    || !sameDate(recognition.recognizedAt, interval.activeFrom) || !sameDate(interval.activeTo, month.end)
    || !sha(recognition.parameterSnapshotHash)) return unavailable();
  if (interval.reasonCode !== 'MONTHLY_ELIGIBLE_CONSUMPTION_THRESHOLD'
    || interval.evidenceHash !== hash({ accumulatorId: accumulator.qualificationMonthAccumulatorEvidenceId, from: interval.activeFrom.toISOString(), to: interval.activeTo.toISOString() })
    || accumulator.evidenceHash !== hash({ recognitionId: recognition.consumptionRecognitionEventId, before: accumulator.cumulativeBefore.toString(), delta: accumulator.eligibleDelta.toString(), after: accumulator.cumulativeAfter.toString(), threshold: accumulator.activeThreshold.toString() })
    || recognition.evidenceHash !== hash({ qualificationId, sourceType: recognition.sourceType, sourceId: recognition.sourceId, sourceLineId: recognition.sourceLineId,
      eligible: recognition.eligible, eligibleAmount: recognition.eligibleAmount.toString(), purpose: recognition.recognitionPurpose, recognizedAt: recognition.recognizedAt.toISOString(), month: month.key })) return invalid();
  const active = await tx.activePeriod.findMany({ where: { qualificationId, activeFrom: { lte: now }, OR: [{ activeTo: null }, { activeTo: { gt: now } }] }, take: 2 });
  if (active.length !== 1 || active[0].sourceType !== 'CONSUMPTION_RECOGNITION' || active[0].sourceId !== interval.activeIntervalEvidenceId
    || active[0].ruleVersionCode !== interval.ruleVersionCode || !sameDate(active[0].activeFrom, interval.activeFrom)
    || !active[0].activeTo || !sameDate(active[0].activeTo, interval.activeTo)) return unavailable();
  return { status: 'AVAILABLE', finality: 'NOT_APPLICABLE', scope: { qualificationId }, updatedAt: interval.createdAt.toISOString(),
    ruleVersion: interval.ruleVersionCode, parameterVersion: recognition.parameterSnapshotHash,
    evidenceRefs: [
      { type: 'ActiveIntervalEvidence', id: interval.activeIntervalEvidenceId, revision: interval.evidenceHash },
      { type: 'QualificationMonthAccumulatorEvidence', id: accumulator.qualificationMonthAccumulatorEvidenceId, revision: accumulator.evidenceHash },
      { type: 'ConsumptionRecognitionEvent', id: recognition.consumptionRecognitionEventId, revision: recognition.evidenceHash },
    ], result: { active: true, ownerType: 'MEMBER', reasonCode: 'THRESHOLD_MET' } };
}

/** Original sealed batch evidence only, not current or latest corrected Carry. */
export async function readMemberSettlementCarry(tx: Prisma.TransactionClient, qualificationId: string, settlementBatchId: string): Promise<SourceRead> {
  const batch = await tx.settlementBatch.findUnique({ where: { settlementBatchId } });
  if (!batch || batch.settlementType !== 'BINARY_K1' || batch.status !== 'FINALIZED' || !batch.finalizedAt || !sha(batch.calculationHash)) return unavailable();
  const row = await tx.historicalReplaySnapshot.findUnique({ where: { kind_sourceId: { kind: 'BINARY_K1', sourceId: settlementBatchId } } });
  if (!row) return unavailable();
  let evidence: ReturnType<typeof verifyReplayEnvelope>;
  try { evidence = verifyReplayEnvelope(row); } catch { return invalid(); }
  if (evidence.kind !== 'BINARY_K1' || evidence.sourceId !== settlementBatchId || evidence.ruleVersionCode !== batch.ruleVersionCode
    || evidence.inputs?.periodStart !== batch.periodStart.toISOString() || evidence.inputs?.periodEnd !== batch.periodEnd.toISOString()
    || !sha(evidence.parameters?.hash)) return invalid();
  const rows = Array.isArray(evidence.evidence?.carryRecipients)
    ? evidence.evidence.carryRecipients.filter((item: { qualificationId?: string }) => item?.qualificationId === qualificationId) : [];
  if (rows.length !== 1) return unavailable();
  // Keep source strings. The shared contract validates decimal shape/range without JS Number conversion.
  return { status: 'AVAILABLE', finality: 'FINALIZED', scope: { qualificationId, settlementBatchId },
    periodEnd: batch.periodEnd.toISOString(), updatedAt: batch.finalizedAt.toISOString(),
    ruleVersion: batch.ruleVersionCode, parameterVersion: evidence.parameters.hash,
    evidenceRefs: [{ type: 'SettlementBatch', id: settlementBatchId, revision: batch.calculationHash },
      { type: 'HistoricalReplaySnapshot', id: row.snapshotId, revision: row.hash }],
    result: { leftCarry: rows[0].leftCarryOut, rightCarry: rows[0].rightCarryOut } };
}
