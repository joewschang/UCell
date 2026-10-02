/** Approved Overlay A: independent calendar-month streak per Qualification. */
export const INACTIVITY_SCOPE = 'QUALIFICATION' as const;
export type InactivityMonth = { qualificationId: string; month: string; active: boolean | null; finalized: boolean; revision: string };
function monthNumber(month: string): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('INVALID_CALENDAR_MONTH');
  const [year, value] = month.split('-').map(Number); return year * 12 + value - 1;
}
/** Replay replaces the input evidence, never updates paid awards or tree edges. */
export function evaluateQualificationInactivity(qualificationId: string, firstCountedMonth: string, throughMonth: string, evidence: InactivityMonth[], ruleVersion: string) {
  if (!ruleVersion) throw new Error('INACTIVITY_RULE_VERSION_REQUIRED');
  const first = monthNumber(firstCountedMonth), through = monthNumber(throughMonth);
  if (through < first) throw new Error('INVALID_INACTIVITY_RANGE');
  const rows = new Map<number, InactivityMonth>();
  for (const row of evidence) {
    if (row.qualificationId !== qualificationId) continue;
    const n = monthNumber(row.month);
    if (n < first || n > through) continue;
    if (rows.has(n)) throw new Error('AMBIGUOUS_MONTH_EVIDENCE');
    rows.set(n, row);
  }
  let streak = 0;
  const snapshots: Array<{ month: string; streakBefore: number; streakAfter: number; evidenceRevision: string; notificationCode: string }> = [];
  for (let n = first; n <= through; n++) {
    const row = rows.get(n);
    if (!row || !row.finalized || row.active === null || !row.revision) return { status: 'PENDING' as const, reason: 'FINALIZED_ACTIVE_EVIDENCE_REQUIRED', qualificationId, ruleVersion, streak: null, recoveryEligible: false, recoveryMonth: null, snapshots };
    const before = streak;
    streak = row.active ? 0 : streak + 1;
    snapshots.push({ month: row.month, streakBefore: before, streakAfter: streak, evidenceRevision: row.revision, notificationCode: row.active ? 'ACTIVE_STREAK_RESET' : streak >= 12 ? 'INACTIVE_RECOVERY_ELIGIBLE' : streak === 11 ? 'INACTIVE_FINAL_WARNING' : streak === 10 ? 'INACTIVE_WARNING' : 'INACTIVE_MONTHLY_NOTICE' });
    if (streak === 12) return { status: 'AVAILABLE' as const, reason: null, qualificationId, ruleVersion, streak, recoveryEligible: true, recoveryMonth: row.month, snapshots };
  }
  return { status: 'AVAILABLE' as const, reason: null, qualificationId, ruleVersion, streak, recoveryEligible: false, recoveryMonth: null, snapshots };
}
