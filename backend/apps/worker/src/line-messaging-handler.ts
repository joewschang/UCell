import type { ProviderWebhookHandler } from '@ucell/database';

/** Messaging ingress currently retains metadata only. A successful lease is an
 * observation acknowledgement; it deliberately creates no Person, order, or
 * monetary effect until a separately versioned normalized-event read model exists. */
export const lineMessagingObserverHandler:ProviderWebhookHandler=Object.freeze({
  async process(lease){
    return lease.domain==='IDENTITY'&&lease.provider==='LINE_MESSAGING'&&lease.connectionId==='LINE_MESSAGING_DEFAULT'
      ? 'SUCCESS' : 'PERMANENT_FAILURE';
  }
});
