import {Prisma} from '@prisma/client';
import {pending} from './parameter-snapshot';
import {replayHash, type ReplayEnvelope} from './historical-replay';

export const GPV_ATTRIBUTION_ACTION = 'GPV_ATTRIBUTION_REBASE';
type AttributionRecord = {beforeHash:string|null; afterHash:string|null; afterData:Prisma.JsonValue|null};

export function applyGpvAttribution(original:ReplayEnvelope, record?:AttributionRecord|null):ReplayEnvelope {
  if (!record || original.kind !== 'GPV') return original;
  const revision = record.afterData as {sourceId:string; graph:ReplayEnvelope['evidence']}|null;
  if (!revision || revision.sourceId !== original.sourceId || record.beforeHash !== replayHash(original) ||
      record.afterHash !== replayHash(revision) || revision.graph?.at !== original.at ||
      revision.graph.sourceQualification?.qualificationId !== original.inputs.qualificationId) {
    pending('GPV_ATTRIBUTION_INVALID','GPV attribution does not match the sealed source');
  }
  return {...original, evidence:revision.graph};
}

export async function attributedGpvEnvelope(tx:Prisma.TransactionClient, original:ReplayEnvelope, knownAt?:Date) {
  if (original.kind !== 'GPV') return original;
  const record = await tx.auditEvent.findFirst({
    where:{action:GPV_ATTRIBUTION_ACTION,entityType:'PV_LEDGER',entityId:original.sourceId,
      ...(knownAt ? {occurredAt:{lte:knownAt}} : {})},
    orderBy:[{occurredAt:'desc'},{auditEventId:'desc'}],
    select:{beforeHash:true,afterHash:true,afterData:true}
  });
  return applyGpvAttribution(original,record);
}

export async function gpvAttributionsAt(tx:Prisma.TransactionClient, ids:string[], knownAt:Date) {
  if (!ids.length) return new Map<string,AttributionRecord>();
  const records = await tx.auditEvent.findMany({
    where:{action:GPV_ATTRIBUTION_ACTION,entityType:'PV_LEDGER',entityId:{in:ids},occurredAt:{lte:knownAt}},
    distinct:['entityId'],orderBy:[{entityId:'asc'},{occurredAt:'desc'},{auditEventId:'desc'}],
    select:{entityId:true,beforeHash:true,afterHash:true,afterData:true}
  });
  return new Map(records.map(row => [row.entityId!,row]));
}

export async function currentTheoryForBall(tx:Prisma.TransactionClient, qualificationId:string) {
  const heads=await tx.$queryRaw<Array<{sourceId:string;revision:Prisma.JsonObject;beforeHash:string;afterHash:string;originalHash:string|null;originalAt:string|null;occurredAt:Date;recordedAt:Date;sourceQualificationId:string;rule:string;snapshotHash:string}>>`
    WITH revisions AS (
      SELECT DISTINCT ON (entity_id) entity_id,before_hash,after_hash,after_data,occurred_at FROM audit.audit_event
      WHERE action='GPV_ATTRIBUTION_REBASE' AND entity_type='PV_LEDGER'
      ORDER BY entity_id,occurred_at DESC,audit_event_id DESC
    )
    SELECT r.entity_id AS "sourceId",r.after_data AS revision,r.before_hash AS "beforeHash",
      r.after_hash AS "afterHash",s.hash AS "originalHash",s.content->>'at' AS "originalAt",
      e.occurred_at AS "occurredAt",r.occurred_at AS "recordedAt",e.qualification_id AS "sourceQualificationId",
      e.rule_version_code AS rule,e.parameter_snapshot_hash AS "snapshotHash"
    FROM revisions r JOIN ledger.pv_ledger e ON e.event_id=r.entity_id
    LEFT JOIN ledger.historical_replay_snapshot s ON s.kind='GPV' AND s.source_id=r.entity_id
    WHERE jsonb_path_exists(r.after_data->'theory','$[*] ? (@.recipientQualificationId == $id)',
      jsonb_build_object('id',${qualificationId}::text)) OR EXISTS (
        SELECT 1 FROM ledger.theory_calculation_evidence t
        WHERE t.source_volume_event_id=r.entity_id AND t.recipient_qualification_id=${qualificationId}::uuid)`;
  const base=await tx.theoryCalculationEvidence.findMany({where:{recipientQualificationId:qualificationId,
    sourceVolumeEventId:{notIn:heads.map(h=>h.sourceId)}},orderBy:[{occurredAt:'desc'},{theoryCalculationEvidenceId:'asc'}],take:200});
  const revised=heads.flatMap(h=>{
    const payload=h.revision as {sourceId:string;graph:ReplayEnvelope['evidence'];theory:Prisma.JsonObject[]};
    if(!payload || !h.originalHash || h.originalHash!==h.beforeHash || h.afterHash!==replayHash(payload) ||
       payload.sourceId!==h.sourceId || payload.graph?.at!==h.originalAt ||
       payload.graph?.sourceQualification?.qualificationId!==h.sourceQualificationId || !Array.isArray(payload.theory)) {
      pending('GPV_ATTRIBUTION_INVALID','GPV theory does not match the sealed source');
    }
    return payload.theory.filter(row=>row.recipientQualificationId===qualificationId).map(row=>{
    return {theoryCalculationEvidenceId:`${h.sourceId}/${row.kind}/${row.generation}`,sourceVolumeEventId:h.sourceId,
      sourceQualificationId:h.sourceQualificationId,recipientQualificationId:qualificationId,theoryKind:row.kind,
      fixedGenerationNo:row.generation,baseAmount:row.baseAmount,rateSnapshot:row.rate,theoryAmount:row.amount,
      activeSnapshot:row.active,unlockEligibleSnapshot:row.unlocked,reasonCode:'CURRENT_TREE_REBASE',
      ruleVersionCode:h.rule,parameterSnapshotHash:h.snapshotHash,occurredAt:h.occurredAt,createdAt:h.recordedAt};
    });
  });
  return [...base,...revised].sort((a,b)=>b.occurredAt.getTime()-a.occurredAt.getTime()||
    a.theoryCalculationEvidenceId.localeCompare(b.theoryCalculationEvidenceId)).slice(0,200);
}
