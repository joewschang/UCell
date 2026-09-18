import {PrismaClient} from '@prisma/client';
import {OutboxLease,withOutboxLease} from './outbox-lease';
/** Commands publish projections atomically; the worker verifies their committed watermark. */
export async function processTreeProjectionEvent(db:PrismaClient,lease:OutboxLease){
 return withOutboxLease(db,lease,async tx=>{
  const event=await tx.outboxEvent.findUniqueOrThrow({where:{outboxEventId:lease.outboxEventId}});
  const payload=event.payload as Record<string,unknown>;
  if(event.eventType!=='BINARY_TREE_CHANGED'||event.aggregateType!=='BinaryTree'||!payload||payload.schemaVersion!==1||payload.binaryTreeId!==event.aggregateId||typeof payload.topologyVersion!=='number'||!Number.isSafeInteger(payload.topologyVersion)||payload.topologyVersion<1)throw new Error('TREE_OUTBOX_PAYLOAD_INVALID');
  const [tree,checkpoint]=await Promise.all([
   tx.binaryTree.findUnique({where:{binaryTreeId:event.aggregateId}}),
   tx.binaryTreeProjectionCheckpoint.findUnique({where:{binaryTreeId:event.aggregateId}}),
  ]);
  if(!tree||!checkpoint||checkpoint.status!=='READY'||checkpoint.sourceVersion!==tree.topologyVersion||checkpoint.sourceVersion<payload.topologyVersion)throw new Error('TREE_PROJECTION_UNAVAILABLE');
  await tx.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date(),lastError:null}});
  return {binaryTreeId:tree.binaryTreeId,sourceVersion:checkpoint.sourceVersion};
 });
}
