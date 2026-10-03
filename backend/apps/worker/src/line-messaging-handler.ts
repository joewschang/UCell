import type { PrismaService, ProviderWebhookHandler } from '@ucell/database';

/** Metadata acknowledgement can wake presentation maintenance on follow/unblock.
 * It never creates a Person, membership, order or monetary effect. */
export function createLineMessagingObserverHandler(db:Pick<PrismaService,'lineMessagingEvent'>,richMenus?:{followHashes(hashes:string[]):Promise<void>}):ProviderWebhookHandler{return Object.freeze({
  async process(lease){
    if(lease.domain!=='IDENTITY'||lease.provider!=='LINE_MESSAGING'||lease.connectionId!=='LINE_MESSAGING_DEFAULT')return 'PERMANENT_FAILURE';
    if(richMenus){
      const rows=await (db.lineMessagingEvent as any).findMany({where:{providerWebhookInboxId:lease.providerWebhookInboxId,status:'PENDING',eventType:'follow'},select:{sourceSubjectHash:true}});
      await richMenus.followHashes(rows.map((r:{sourceSubjectHash:string|null})=>r.sourceSubjectHash).filter(Boolean));
    }
    const changed=await (db.lineMessagingEvent as any).updateMany({where:{providerWebhookInboxId:lease.providerWebhookInboxId,status:'PENDING',eventType:{in:['follow','unfollow','postback','message']}},data:{status:'PROCESSED',processedAt:new Date(),attemptCount:{increment:1},lastErrorCode:null}});
    // Empty verification, duplicate retry and unsupported event types are safe no-ops.
    return 'SUCCESS';
  }
});}
