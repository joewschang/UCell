import type { PrismaService, ProviderWebhookHandler } from '@ucell/database';

/** Messaging ingress currently retains metadata only. A successful lease is an
 * observation acknowledgement; it deliberately creates no Person, order, or
 * monetary effect until a separately versioned normalized-event read model exists. */
export function createLineMessagingObserverHandler(db:Pick<PrismaService,'lineMessagingEvent'>):ProviderWebhookHandler{return Object.freeze({
  async process(lease){
    if(lease.domain!=='IDENTITY'||lease.provider!=='LINE_MESSAGING'||lease.connectionId!=='LINE_MESSAGING_DEFAULT')return 'PERMANENT_FAILURE';
    const changed=await (db.lineMessagingEvent as any).updateMany({where:{providerWebhookInboxId:lease.providerWebhookInboxId,status:'PENDING',eventType:{in:['follow','unfollow','postback']}},data:{status:'PROCESSED',processedAt:new Date(),attemptCount:{increment:1},lastErrorCode:null}});
    return changed.count?'SUCCESS':'PERMANENT_FAILURE';
  }
});}
