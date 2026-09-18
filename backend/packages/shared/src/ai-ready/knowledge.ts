import { DataClassification } from './catalog';
import { contractFail, isId, isInstant, UCellRequestContext } from './contracts';

export interface KnowledgeDocument {
  documentId: string; documentType: 'RULE' | 'FAQ' | 'PRODUCT' | 'CONTENT'; title: string; version: string;
  status: 'DRAFT' | 'APPROVED' | 'SUPERSEDED' | 'ARCHIVED'; effectiveFrom: string; effectiveTo: string | null;
  recordedAt: string; approvedAt: string | null;
  authorityLevel: number; approvedBy: string | null; approvalRef: string | null;
  supersedes: string | null; supersededBy: string | null; language: 'zh-TW' | 'en';
  source: string; sourceHash: string; dataClassification: DataClassification; ingestionEligibility: boolean;
}
export interface KnowledgeUnit {
  unitId: string; parentDocumentId: string; parentVersion: string; parentHash: string;
  section: string; semanticTopic: string; recordedAt: string; effectiveFrom: string; effectiveTo: string | null;
  authorityLevel: number; citation: string; sourceRange: { start: number; end: number };
  supersedes: string | null; dataClassification: DataClassification;
}
/** Metadata-only simulator: no document ingestion, embeddings, vector store or provider. */
export function lookupGovernedKnowledge(documents: readonly KnowledgeDocument[], units: readonly KnowledgeUnit[],
  request: { topic: string; effectiveAt: string; knowledgeCutoff: string; locale: 'zh-TW' | 'en' }, context: UCellRequestContext) {
  if (!isId(request.topic) || !isInstant(request.effectiveAt) || !isInstant(request.knowledgeCutoff) || !['zh-TW','en'].includes(request.locale)) return contractFail('INVALID_QUERY');
  if (!context.permissions.includes('knowledge:read')) return contractFail('DENIED');
  const allowedClass = (classification: DataClassification) => classification === 'PUBLIC'
    || (context.actorType === 'ADMIN' && classification === 'ADMIN_OPERATIONAL' && context.permissions.includes('knowledge:admin:read'));
  const eligible = documents.filter(doc => doc.status === 'APPROVED' && doc.supersededBy === null && doc.approvedBy && doc.approvalRef
    && isInstant(doc.recordedAt) && isInstant(doc.approvedAt) && doc.recordedAt <= doc.approvedAt && doc.approvedAt <= request.knowledgeCutoff
    && doc.ingestionEligibility && doc.language === request.locale && allowedClass(doc.dataClassification)
    && isInstant(doc.effectiveFrom) && (doc.effectiveTo === null || isInstant(doc.effectiveTo))
    && doc.effectiveFrom <= request.effectiveAt && (doc.effectiveTo === null || request.effectiveAt < doc.effectiveTo)
    && isId(doc.documentId) && isId(doc.version) && /^[a-f0-9]{64}$/.test(doc.sourceHash) && Number.isInteger(doc.authorityLevel));
  const matches = units.flatMap(unit => eligible.filter(doc => unit.semanticTopic === request.topic && unit.parentDocumentId === doc.documentId
    && unit.parentVersion === doc.version && unit.parentHash === doc.sourceHash && unit.authorityLevel === doc.authorityLevel
    && unit.dataClassification === doc.dataClassification && isInstant(unit.effectiveFrom)
    && isInstant(unit.recordedAt) && unit.recordedAt >= doc.recordedAt && unit.recordedAt <= request.knowledgeCutoff
    && unit.effectiveFrom >= doc.effectiveFrom && unit.effectiveFrom <= request.effectiveAt
    && (unit.effectiveTo === null ? doc.effectiveTo === null : isInstant(unit.effectiveTo) && request.effectiveAt < unit.effectiveTo
      && (doc.effectiveTo === null || unit.effectiveTo <= doc.effectiveTo))
    && Number.isInteger(unit.sourceRange.start) && Number.isInteger(unit.sourceRange.end) && unit.sourceRange.start >= 1
    && unit.sourceRange.end >= unit.sourceRange.start).map(doc => ({ doc, unit })));
  if (!matches.length) return { quality: 'UNAVAILABLE' as const, result: null };
  const authority = Math.min(...matches.map(m => m.doc.authorityLevel));
  const highest = matches.filter(m => m.doc.authorityLevel === authority);
  if (new Set(highest.map(m => `${m.doc.documentId}:${m.doc.version}`)).size !== 1) return contractFail('INVALID_EVIDENCE');
  // No free text from documents is treated as instructions; return approved citation metadata only.
  return { quality: 'KNOWLEDGE_ONLY' as const, result: highest.slice(0,20).map(({doc,unit}) => ({ documentId: doc.documentId,
    version: doc.version, unitId: unit.unitId, section: unit.section, sourceRange: {...unit.sourceRange}, sourceHash: doc.sourceHash })) };
}

export interface EventEvidenceDefinition {
  key: string; version: '1'; businessMeaning: string; grain: string; source: string;
  effectiveAt: string; recordedAt: string; immutableEvidence: readonly string[];
  replayBehavior: string; ruleVersionRelation: string; safeMemberFields: readonly string[];
  safeAdminFields: readonly string[]; aiExposureClass: DataClassification;
}
const sourceEvidence: Readonly<Record<string,readonly string[]>> = {
 ConsumptionRecognition:['consumptionRecognitionEventId','evidenceHash','parameterSnapshotHash','reversalOfEventId'],
 VolumeRecognition:['PvLedger.eventId','PvLedger.parameterSnapshotHash','PvLedger.reversalOfEventId','VolumeRecognitionClassification.evidenceHash'],
 ActiveTransition:['activeIntervalEvidenceId','sourceAccumulatorEvidenceId','evidenceHash','supersedesActiveEvidenceId'],
 SponsorRelationship:['sponsorRelationshipId','sponsorQualificationId','childQualificationId','sponsorSequenceNo','effectiveFrom'],
 BinaryPlacement:['binaryPlacementId','parentQualificationId','childQualificationId','side','effectiveFrom'],
 Award:['bonusAwardId','theoryAmount','kFactor','payableAmount','parameterSnapshotHash'],
 Settlement:['settlementBatchId','calculationHash','parameterSnapshot','finalizedAt'],
 ReturnPosted:['ReturnCase.returnCaseId','ReturnLine.returnLineId','AuditEvent.auditEventId'],
 Replay:['actionKey','stateHash','result'],
 Recovery:['bonusRecoveryEventId','bonusAwardId','returnCaseId','recoveryAmount'],
 Clawback:['lifecycleEventId','bonusAwardId','sourceEventId','status'],
 Payout:['PayoutLine.payoutLineId','PayoutLine.netAmount','PayoutBatch.paidAt','AuditEvent.auditEventId'],
 QualificationOwnership:['holderHistoryId','qualificationId','holderPersonId','effectiveFrom'],
 ReservoirEffect:['reservoirLedgerEffectId','sourceGlobalSettlementId','evidenceHash','replayActionKey'],
};
const events = [
  ['ConsumptionRecognition','Eligible cash consumption, not order existence','source-line/Qualification','ConsumptionRecognitionEvent','recognizedAt'],
  ['VolumeRecognition','Concrete GPV/RPV/EPV recognition','event/Qualification','PvLedger + VolumeRecognitionClassification','occurredAt'],
  ['ActiveTransition','Threshold crossing or revised eligibility interval','Qualification/interval','ActiveIntervalEvidence','activeFrom'],
  ['SponsorRelationship','Actual independent referral chronology','Sponsor/child','SponsorRelationship','effectiveFrom'],
  ['BinaryPlacement','Binary parent and side, independent from Sponsor','parent/child','BinaryPlacement','effectiveFrom'],
  ['Award','Stored theory/K/final entitlement','award/recipient','BonusAward','occurredAt'],
  ['Settlement','Authoritative finalized batch','period/batch','SettlementBatch','periodEnd'],
  ['ReturnPosted','Economic reversal; earlier workflow states excluded','return/line','ReturnCase','occurredAt'],
  ['Replay','Append-only historical correction','run/revision','ReplayAction','createdAt'],
  ['Recovery','Recoverable paid overage','recipient/source','BonusRecoveryEvent','occurredAt'],
  ['Clawback','Linked paid adjustment, original immutable','award/event','BonusAwardLifecycleEvent','occurredAt'],
  ['Payout','Payment lifecycle, distinct from final entitlement','payout/item','PayoutLine + PayoutBatch + AuditEvent','PayoutBatch.paidAt'],
  ['QualificationOwnership','Owner interval preserving Qualification identity','Qualification/interval','QualificationHolderHistory','effectiveFrom'],
  ['ReservoirEffect','A Global remainder or separately activated B entitlement','source/revision','ReservoirLedgerEffect (A only)','sourcePeriodEnd'],
] as const;
export const EVENT_EVIDENCE_DICTIONARY: readonly EventEvidenceDefinition[] = Object.freeze(events.map(([key,businessMeaning,grain,source,effectiveAt]) => Object.freeze({
  key, version: '1' as const, businessMeaning, grain, source, effectiveAt, recordedAt: key === 'VolumeRecognition' ? 'PvLedger.recordedAt' : key === 'Payout' ? 'AuditEvent.occurredAt' : 'createdAt',
  immutableEvidence: Object.freeze([...sourceEvidence[key]]),
  replayBehavior: 'Preserve original, read linked correction revision; never reconstruct missing history from current state.',
  ruleVersionRelation: 'Use stored effective rule/parameter evidence; missing version is unavailable.',
  safeMemberFields: Object.freeze(['authorizedOwnQualificationId','effectiveAt','status','evidenceReference']),
  safeAdminFields: Object.freeze(['authorizedScopeId','effectiveAt','recordedAt','status','evidenceReference']),
  aiExposureClass: key === 'ReservoirEffect' ? 'FINANCE_CONFIDENTIAL' as const : 'MEMBER_SELF' as const,
})));
