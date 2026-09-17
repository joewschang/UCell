/** UCell-owned definitions. No model/provider dependency or monetary calculation. */
export type DataClassification = 'PUBLIC' | 'MEMBER_SELF' | 'MEMBER_SENSITIVE'
  | 'ADMIN_OPERATIONAL' | 'FINANCE_CONFIDENTIAL' | 'SECRET_NEVER_AI';
export type ToolName = 'getActiveStatus' | 'explainBinaryCarry' | 'explainBinarySettlementCarry' | 'explainReservoirB';
export interface ReadDefinition {
  readonly key: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly grain: 'QUALIFICATION_PERIOD' | 'QUALIFICATION_TREE_PERIOD' | 'QUALIFICATION_SETTLEMENT' | 'LEDGER_ENTRY';
  readonly source: string;
  readonly dimensions: readonly string[];
  readonly timeMode: 'CURRENT' | 'PERIOD' | 'ENTRY';
  readonly timestampMeaning: string;
  readonly timezone: 'Asia/Taipei';
  readonly boundary: '[from,to)';
  readonly replayPolicy: string;
  readonly rounding: 'PRESERVE_SOURCE_DECIMAL';
  readonly nullPolicy: 'UNAVAILABLE_NOT_ZERO';
  readonly classification: DataClassification;
  readonly requiredPermission: string;
}
const definition = (value: ReadDefinition): ReadDefinition => Object.freeze({
  ...value, dimensions: Object.freeze([...value.dimensions]),
});
const common = {
  version: '1', timezone: 'Asia/Taipei', boundary: '[from,to)',
  rounding: 'PRESERVE_SOURCE_DECIMAL', nullPolicy: 'UNAVAILABLE_NOT_ZERO',
} as const;
export const READ_DEFINITIONS: Readonly<Record<ToolName, ReadDefinition>> = Object.freeze({
  getActiveStatus: definition({ ...common, key: 'active.status', name: '球的 Active 狀態',
    description: 'Authoritative eligibility state, including explicit ownership classification; never inferred from a displayed label.',
    grain: 'QUALIFICATION_PERIOD', source: 'Member v3 ActiveInterval/Accumulator/Consumption evidence adapter (current original active or evidence-backed below-threshold state)',
    dimensions: ['qualificationId'], timeMode: 'CURRENT', timestampMeaning: 'Authoritative current source observation',
    replayPolicy: 'Use source eligibility and ownership evidence; no earlier-event backfill.',
    classification: 'MEMBER_SELF', requiredPermission: 'explain:active:read' }),
  explainBinaryCarry: definition({ ...common, key: 'binary.carry', name: '雙軌結轉',
    description: 'Exact stored left/right Carry for the requested tree and finalized period revision.',
    grain: 'QUALIFICATION_TREE_PERIOD', source: 'Finalized Binary snapshot adapter (not yet connected)',
    dimensions: ['qualificationId', 'binaryTreeId'], timeMode: 'PERIOD', timestampMeaning: 'Exclusive settlement period end',
    replayPolicy: 'Return the authoritative revision and its evidence; never recompute Carry.',
    classification: 'MEMBER_SELF', requiredPermission: 'explain:binary:read' }),
  explainBinarySettlementCarry: definition({ ...common, key: 'binary.settlement_carry', name: '結算批次結轉證據',
    description: 'Original sealed Carry evidence for one Qualification and settlement batch; no inferred tree or latest replay claim.',
    grain: 'QUALIFICATION_SETTLEMENT', source: 'Sealed BINARY_K1 historical replay snapshot',
    dimensions: ['qualificationId', 'settlementBatchId'], timeMode: 'PERIOD', timestampMeaning: 'Exclusive source settlement period end',
    replayPolicy: 'Original sealed revision only; latest corrected Carry is a separate read contract.',
    classification: 'MEMBER_SELF', requiredPermission: 'explain:binary:read' }),
  explainReservoirB: definition({ ...common, key: 'reservoir.b.entry', name: '水庫 B 分錄',
    description: 'One company entitlement accrual or signed correction, never an A balance or a withdrawal.',
    grain: 'LEDGER_ENTRY', source: 'Reservoir B ledger adapter (not yet implemented)',
    dimensions: ['entryId', 'qualificationId', 'binaryTreeId'], timeMode: 'ENTRY', timestampMeaning: 'Source entry effective time',
    replayPolicy: 'Preserve source revision and correction reference; no duplicate accrual.',
    classification: 'FINANCE_CONFIDENTIAL', requiredPermission: 'explain:reservoir-b:read' }),
});
