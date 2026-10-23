"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geoDescendants = geoDescendants;
exports.geoGpvSources = geoGpvSources;
/** Immutable heap positions cover deep subtrees even when only canonical ancestry anchors are stored. */
async function geoDescendants(tx, treeId, position, time) {
    const prefix = position.toString(2), at = new Date(time.asOf), known = new Date(time.knowledgeCutoff);
    return tx.$queryRaw `
  SELECT m.qualification_id::text AS "descendantQualificationId",
   CASE substring(ltrim(m.binary_position_no::bit(64)::text,'0') FROM ${prefix.length + 1}::int FOR 1) WHEN '0' THEN 'LEFT' ELSE 'RIGHT' END AS "firstSide"
  FROM organization.binary_tree_membership m
  WHERE m.binary_tree_id=${treeId}::uuid AND m.binary_position_no>${position}
   AND ltrim(m.binary_position_no::bit(64)::text,'0') LIKE ${prefix + '%'}
   AND m.effective_from<=${at} AND m.recorded_at<=${known}
  ORDER BY m.qualification_id LIMIT 501`;
}
/** Supply source IDs to the existing sealed replay/reversal verifier; never calculate awards here. */
async function geoGpvSources(tx, treeId, position, time) {
    const prefix = position.toString(2), at = new Date(time.asOf), known = new Date(time.knowledgeCutoff);
    return tx.$queryRaw `
  SELECT e.event_id,
   CASE substring(ltrim(m.binary_position_no::bit(64)::text,'0') FROM ${prefix.length + 1}::int FOR 1) WHEN '0' THEN 'LEFT' ELSE 'RIGHT' END AS first_side
  FROM ledger.pv_ledger e JOIN organization.binary_tree_membership m ON m.qualification_id=e.qualification_id
  WHERE m.binary_tree_id=${treeId}::uuid AND m.binary_position_no>${position}
   AND ltrim(m.binary_position_no::bit(64)::text,'0') LIKE ${prefix + '%'}
   AND m.effective_from<=e.occurred_at AND m.recorded_at<=${known}
   AND e.pv_type='GPV' AND e.event_type='GPV_CREATED' AND e.reversal_of_event_id IS NULL
   AND e.occurred_at<${at} AND e.recorded_at<=${known}
  ORDER BY e.event_id LIMIT 2001`;
}
//# sourceMappingURL=geo-membership-scope.js.map