import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { PrismaService } from '@ucell/database';
import { ProviderWebhookInboxService } from '../commerce/provider-webhook-inbox.service';
import { LineMessagingAdapter } from './line-messaging.adapter';

/** Raw-byte boundary for LINE Messaging. HTTP transport must supply the untouched body. */
@Injectable()
export class LineMessagingIngressService {
  constructor(private readonly inbox:ProviderWebhookInboxService,private readonly adapter:LineMessagingAdapter,private readonly db:PrismaService){}
  async receive(input:{rawBody:Uint8Array;signature?:string;channelSecret?:string;configVersion?:string;correlationId?:string}){
    const configVersion=input.configVersion;
    if(!input.channelSecret||!configVersion) throw new ServiceUnavailableException({code:'LINE_MESSAGING_CONFIGURATION_PENDING'});
    if(!this.adapter.validateWebhookSignature(input.rawBody,input.signature,input.channelSecret)) throw new UnauthorizedException({code:'LINE_WEBHOOK_SIGNATURE_INVALID'});
    let parsed:unknown;try{parsed=JSON.parse(Buffer.from(input.rawBody).toString('utf8'));}catch{throw new UnauthorizedException({code:'LINE_WEBHOOK_PAYLOAD_INVALID'});}
    const rawEvents:unknown[]=parsed&&typeof parsed==='object'&&Array.isArray((parsed as {events?:unknown}).events)?(parsed as {events:unknown[]}).events:[];
    const events=rawEvents.map((event:unknown)=>this.adapter.normalizeWebhookEvent(event)).filter(Boolean);
    const row=await this.db.$transaction(async tx=>{
      const inbox=await this.inbox.receive({domain:'IDENTITY',provider:'LINE_MESSAGING',connectionId:'LINE_MESSAGING_DEFAULT',rawBody:input.rawBody,safeEvidenceRef:'line://messaging/webhook',verificationConfigVersion:configVersion,correlationId:input.correlationId??randomUUID()},tx);
      await tx.lineMessagingEvent.createMany({data:events.map(event=>({providerWebhookInboxId:inbox.providerWebhookInboxId,providerEventIdentity:event!.eventId,eventType:event!.type,occurredAt:new Date(event!.timestamp),sourceSubjectHash:event!.sourceUserId?createHash('sha256').update(event!.sourceUserId).digest('hex'):null,payloadHash:inbox.payloadHash})),skipDuplicates:true});
      return inbox;
    });
    return {providerWebhookInboxId:row.providerWebhookInboxId,status:row.status,eventCount:events.length};
  }
}
