import { createHmac, timingSafeEqual } from 'node:crypto';

export type LineWebhookEvent={eventId:string;type:string;timestamp:number;sourceUserId?:string};
export class LineMessagingAdapter {
  validateWebhookSignature(rawBody:Uint8Array,signature:string|undefined,channelSecret:string|undefined){
    if(!channelSecret||!signature||!rawBody.byteLength) return false;
    const expected=createHmac('sha256',channelSecret).update(rawBody).digest('base64');
    const actual=Buffer.from(signature);const expectedBytes=Buffer.from(expected);
    return actual.length===expectedBytes.length&&timingSafeEqual(actual,expectedBytes);
  }
  normalizeWebhookEvent(value:unknown):LineWebhookEvent|null{
    if(!value||typeof value!=='object')return null;
    const event=value as Record<string,unknown>,source=event.source as Record<string,unknown>|undefined;
    if(typeof event.webhookEventId!=='string'||!event.webhookEventId||typeof event.type!=='string'||!event.type||typeof event.timestamp!=='number'||!Number.isSafeInteger(event.timestamp))return null;
    return {eventId:event.webhookEventId,type:event.type,timestamp:event.timestamp,sourceUserId:typeof source?.userId==='string'?source.userId:undefined};
  }
}
