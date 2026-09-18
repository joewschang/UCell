import {Prisma} from '@ucell/database';
import {AsOfContext} from '@ucell/shared';
/** Conservative completeness across all pools: one return may propagate across periods/trees. */
export async function financialCompleteness(tx:Prisma.TransactionClient,time:AsOfContext){
 const known=new Date(time.knowledgeCutoff),at=new Date(time.asOf);
 const [r]=await tx.$queryRaw<Array<{pendingReturns:string;pendingReplays:string}>>`SELECT
  (SELECT count(*)::text FROM commerce.return_case r WHERE r.status='POSTED' AND r.posted_at<=${known} AND r.posted_at<=${at}
   AND NOT EXISTS(SELECT 1 FROM audit.audit_event a WHERE a.action='RETURN_REVERSAL_PROCESSED' AND a.entity_id=r.return_case_id AND a.occurred_at<=${known})) AS "pendingReturns",
  (SELECT count(*)::text FROM ledger.settlement_recalculation_request WHERE created_at<=${known}
   AND(processed_at IS NULL OR processed_at>${known})) AS "pendingReplays"`;
 return {...r,status:r.pendingReturns==='0'&&r.pendingReplays==='0'?'CURRENT' as const:'STALE' as const,scope:'CONSERVATIVE_ALL_DOWNSTREAM_POOLS'};
}
