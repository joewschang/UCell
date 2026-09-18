import { DataClassification } from './catalog';

/** Definitions describe authoritative facts; they never calculate compensation. */
export interface BusinessTermDefinition {
  readonly key: string; readonly version: '1'; readonly name: string;
  readonly meaning: string; readonly grain: 'PERSON' | 'QUALIFICATION' | 'TREE' | 'EVENT' | 'PERIOD' | 'CLASS';
  readonly source: string; readonly classification: DataClassification;
}
const terms = [
  ['Qualification', '經營資格（球）', 'Independent operating and economic identity; never aggregate another Ball implicitly.', 'QUALIFICATION', 'membership.Qualification'],
  ['Person', '自然人', 'Identity that may hold multiple independent Qualifications.', 'PERSON', 'identity.Person'],
  ['CompanyBall', '公司球', 'Explicit company-owned interval; Always Active does not grant plan/rank privileges.', 'QUALIFICATION', 'QualificationOwnerInterval'],
  ['FoundingBall', '創始位置的球', 'Occupant of per-tree canonical #4–#7; no special compensation or Active privilege.', 'QUALIFICATION', 'FoundingOccupationEvidence'],
  ['Active', 'Active', 'Qualification monthly eligible consumption reaches NT$2,000 at recognition time; no earlier-event backfill.', 'QUALIFICATION', 'ActiveIntervalEvidence'],
  ['PV', 'PV 類別', 'Abstract volume class; GPV/RPV/EPV are its concrete types, not four peer amounts.', 'CLASS', 'SA-20260917-13'],
  ['BV', 'BV 類別', 'Reserved abstract class with no active R1.0B monetary formula.', 'CLASS', 'SA-20260917-13'],
  ['GPV', '一般業績', 'Concrete general performance volume; preserve original recognition identity.', 'EVENT', 'PvLedger/VolumeRecognitionClassification'],
  ['RPV', '重購業績', 'Concrete repurchase performance; not eligible-consumption currency.', 'EVENT', 'PvLedger/VolumeRecognitionClassification'],
  ['EPV', '超額業績', 'Concrete excess performance from authoritative monthly recognition; not accumulator epvAfter.', 'EVENT', 'PvLedger/VolumeRecognitionClassification'],
  ['Carry', '結算結轉', 'Stored/replayed left/right volume belongs to a Qualification, not its holder.', 'QUALIFICATION', 'BinaryCarry/ReplayCarryProjection'],
  ['PairPV', '配對業績', 'Stored paired general-performance volume at the authoritative weekly close.', 'QUALIFICATION', 'HistoricalReplaySnapshot'],
  ['K0', 'K0', 'Authoritative referral pool settlement factor; no tree-local recalculation.', 'PERIOD', 'SettlementBatch REFERRAL_K0'],
  ['K1', 'K1', 'Authoritative Binary pool settlement factor.', 'PERIOD', 'SettlementBatch BINARY_K1'],
  ['K2', 'K2', 'Authoritative matching pool settlement factor.', 'PERIOD', 'SettlementBatch MATCHING_K2'],
  ['Rank', '聘階', 'Historical rank evidence; distinct from plan and Active. No invented downgrade.', 'QUALIFICATION', 'QualificationGlobalRankHistory'],
  ['ReturnRate', '退貨率', 'POSTED linked returns over the same original recognized-sales cohort; zero denominator is null.', 'PERIOD', 'ReturnCase/ConsumptionRecognitionEvent'],
  ['ReservoirA', '水庫 A', 'Undistributed Global remainder plus signed replay corrections; accrual only.', 'EVENT', 'ReservoirLedgerEffect'],
  ['ReservoirB', '水庫 B', 'Company final entitlement after existing Core calculation; historical LEADER binding governs bootstrap Balls.', 'EVENT', 'ReservoirBEffect/AwardEconomicDestination'],
  ['Recovery', '追償', 'Authoritative recoverable paid overage; original PAID evidence remains immutable.', 'EVENT', 'BonusRecoveryEvent'],
  ['Clawback', '追回調整', 'Linked append-only adjustment after payment; never overwrite original award.', 'EVENT', 'BonusAwardLifecycleEvent/RecoveryApplication'],
  ['Settlement', '結算', 'Authoritative finalized period and rule/parameter snapshot; not proof of payment.', 'PERIOD', 'SettlementBatch'],
  ['Payout', '支付', 'Actual payable/payment lifecycle with persisted business-calendar dates; not literal plus 45 days.', 'EVENT', 'PayableEntry/PayoutLine'],
  ['Tree', '二元樹', 'Independent Binary topology scope; Sponsor graph remains separate.', 'TREE', 'BinaryTree'],
  ['MonthlyNewBalls', '當月新球數', 'First effective placement in Taipei month; transfer/company succession never creates a Ball.', 'TREE', 'PlacementTreeEvidence'],
] as const;
export const BUSINESS_TERMS: Readonly<Record<string, BusinessTermDefinition>> = Object.freeze(Object.fromEntries(
  terms.map(([key, name, meaning, grain, source]) => [key, Object.freeze({ key, version: '1' as const, name, meaning, grain, source, classification: 'PUBLIC' as const })])));

export interface MetricDefinition {
  readonly key: string; readonly definitionVersion: '1'; readonly term: string;
  readonly unit: 'STATE' | 'GPV' | 'RPV' | 'EPV' | 'TWD' | 'COUNT' | 'RATIO';
  readonly grain: 'QUALIFICATION_ENTITLEMENT' | 'QUALIFICATION_PERIOD' | 'SETTLEMENT' | 'SOURCE_COHORT' | 'TREE_PERIOD';
  readonly source: string; readonly dimensions: readonly string[]; readonly filters: readonly string[];
  readonly numerator: string | null; readonly denominator: string | null;
  readonly zeroDenominator: 'NULL_NOT_APPLICABLE'; readonly timezone: 'Asia/Taipei';
  readonly boundary: '[start,end)'; readonly temporalPolicy: string; readonly replayPolicy: string;
  readonly rounding: 'PRESERVE_SOURCE_DECIMAL'; readonly nullPolicy: 'UNAVAILABLE_NOT_ZERO';
  readonly classification: DataClassification; readonly requiredPermission: string;
}
const metricRows = [
  ['rank.bonus','Rank','TWD','TREE_PERIOD','BonusAward/RpvUplineAwardEvent/GlobalPoolAward/EntitlementReplayPosting'],
  ['rank.gpv','Rank','GPV','TREE_PERIOD','PvLedger/QualificationGlobalRankHistory'],
  ['rank.new_achievements','Rank','COUNT','TREE_PERIOD','QualificationGlobalRankHistory'],
  ['tree.comparison','Tree','COUNT','TREE_PERIOD','BinaryTreeMembership/PlacementTreeEvidence'],
  ['bonus.distribution','Settlement','TWD','TREE_PERIOD','BonusAward/RpvUplineAwardEvent/GlobalPoolAward/EntitlementReplayPosting'],
  ['active.member','Active','STATE','QUALIFICATION_PERIOD','ActiveIntervalEvidence'],
  ['volume.gpv','GPV','GPV','QUALIFICATION_PERIOD','PvLedger/VolumeRecognitionClassification'],
  ['volume.rpv','RPV','RPV','QUALIFICATION_PERIOD','PvLedger/VolumeRecognitionClassification'],
  ['volume.epv','EPV','EPV','QUALIFICATION_PERIOD','PvLedger/VolumeRecognitionClassification'],
  ['binary.left_carry','Carry','GPV','QUALIFICATION_PERIOD','BinaryCarry/ReplayCarryProjection'],
  ['binary.right_carry','Carry','GPV','QUALIFICATION_PERIOD','BinaryCarry/ReplayCarryProjection'],
  ['binary.pairpv','PairPV','GPV','QUALIFICATION_PERIOD','HistoricalReplaySnapshot'],
  ['pool.k0','K0','RATIO','SETTLEMENT','SettlementBatch REFERRAL_K0'],
  ['pool.k1','K1','RATIO','SETTLEMENT','SettlementBatch BINARY_K1'],
  ['pool.k2','K2','RATIO','SETTLEMENT','SettlementBatch MATCHING_K2'],
  ['rank.distribution','Rank','COUNT','TREE_PERIOD','QualificationGlobalRankHistory/QualificationOwnerInterval'],
  ['active.rate','Active','RATIO','TREE_PERIOD','ActiveIntervalEvidence/QualificationMonthAccumulatorEvidence/QualificationOwnerInterval'],
  ['rank.effective','Rank','STATE','QUALIFICATION_PERIOD','QualificationGlobalRankHistory'],
  ['return.cohort_rates','ReturnRate','RATIO','SOURCE_COHORT','ConsumptionRecognitionEvent/OrderLine/POSTED ReturnLine'],
  ['return.amount_rate','ReturnRate','RATIO','SOURCE_COHORT','POSTED ReturnLine/ConsumptionRecognitionEvent'],
  ['reservoir.a','ReservoirA','TWD','SETTLEMENT','ReservoirLedgerEffect'],
  ['reservoir.b','ReservoirB','TWD','QUALIFICATION_ENTITLEMENT','ReservoirBEffect/AwardEconomicDestination'],
  ['recovery.amount','Recovery','TWD','QUALIFICATION_PERIOD','BonusRecoveryEvent'],
  ['clawback.amount','Clawback','TWD','QUALIFICATION_PERIOD','RecoveryApplication'],
  ['founding.statistics','FoundingBall','COUNT','TREE_PERIOD','BinaryTreeMembership/Ancestry/PvLedger/ReplayCarryProjection'],
  ['tree.monthly_new_balls','MonthlyNewBalls','COUNT','TREE_PERIOD','PlacementTreeEvidence'],
] as const;
export const METRIC_DEFINITIONS: Readonly<Record<string, MetricDefinition>> = Object.freeze(Object.fromEntries(metricRows.map(([key, term, unit, grain, source]) => {
  const dimensions = Object.freeze(key === 'return.cohort_rates' ? ['binaryTreeId','foundingBallId','productId','currency'] : key === 'founding.statistics' ? ['binaryTreeId','foundingBallId'] : grain === 'QUALIFICATION_PERIOD' ? ['qualificationId'] : grain === 'TREE_PERIOD' ? ['binaryTreeId'] : grain === 'SOURCE_COHORT' ? ['sourceCohortId'] : ['settlementId']);
  return [key, Object.freeze({ key, definitionVersion: '1' as const, term, unit, grain, source, dimensions,
    filters: dimensions, numerator: key === 'active.rate' ? 'Proven Active MEMBER Qualifications at the same checkpoint' : (key === 'return.amount_rate' || key === 'return.cohort_rates') ? 'POSTED returned eligible recognized consideration linked to original cohort' : null,
    denominator: key === 'active.rate' ? 'Eligible MEMBER Qualifications with complete interval evidence at the same checkpoint' : (key === 'return.amount_rate' || key === 'return.cohort_rates') ? 'Original positive eligible recognized consideration of the SAME cohort and currency' : null,
    zeroDenominator: 'NULL_NOT_APPLICABLE' as const, timezone: 'Asia/Taipei' as const, boundary: '[start,end)' as const,
    temporalPolicy: 'Effective events in half-open period before asOf; recordedAt <= knowledgeCutoff. Missing historical evidence fails closed.',
    replayPolicy: 'Read authoritative revision with linked signed corrections; never recalculate money or use current-state fallback.',
    rounding: 'PRESERVE_SOURCE_DECIMAL' as const, nullPolicy: 'UNAVAILABLE_NOT_ZERO' as const,
    classification: (key.startsWith('reservoir.') || key.startsWith('pool.') || key.startsWith('bonus.') || key === 'rank.bonus' ? 'FINANCE_CONFIDENTIAL' : 'ADMIN_OPERATIONAL') as DataClassification,
    requiredPermission: `metric:${key}:read` })];
})));
export type ExplainCode = 'VERIFIED_SOURCE' | 'PARTIAL_EVIDENCE' | 'KNOWLEDGE_ONLY' | 'HISTORICAL_UNAVAILABLE' | 'SOURCE_UNAVAILABLE' | 'NOT_ACTIVATED';
export const EXPLAIN_CODES: Readonly<Record<ExplainCode, string>> = Object.freeze({
  VERIFIED_SOURCE: 'Stored authoritative result; no recalculation.', PARTIAL_EVIDENCE: 'Some requested evidence is missing.',
  KNOWLEDGE_ONLY: 'Approved knowledge, not personal economic evidence.', HISTORICAL_UNAVAILABLE: 'Historical evidence cannot support the requested boundary.',
  SOURCE_UNAVAILABLE: 'No verifiable source result.', NOT_ACTIVATED: 'Domain activation gate remains closed.',
});
