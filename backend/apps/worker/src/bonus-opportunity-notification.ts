import { PrismaService, OutboxLease, claimOutboxLease, withOutboxLease, releaseFailedOutboxLease } from '@ucell/database';
import { lineNotificationSender, LineNotificationSender } from './line-notification-adapter';

/** Durable outbox, immutable content and binding, one stable LINE retry key. */
export async function processBonusOpportunity(db:PrismaService, lease:OutboxLease, sender:LineNotificationSender) {
  const prepared = await withOutboxLease(db,lease,async tx=>{
    const event=await tx.outboxEvent.findUniqueOrThrow({where:{outboxEventId:lease.outboxEventId}});
    if(!['BONUS_OPPORTUNITY_CREATED','BONUS_OPPORTUNITY_CORRECTED'].includes(event.eventType)) throw new Error('BONUS_OPPORTUNITY_EVENT_INVALID');
    const opportunity=await tx.bonusOpportunity.findUniqueOrThrow({where:{bonusOpportunityId:event.aggregateId}});
    const correction=event.eventType==='BONUS_OPPORTUNITY_CORRECTED';
    const payload=event.payload as Record<string,unknown>;
    if(correction&&(typeof payload.message!=='string'||typeof payload.evidenceHash!=='string'||payload.opportunityId!==opportunity.bonusOpportunityId))throw new Error('BONUS_CORRECTION_INVALID');
    if(!correction&&opportunity.outboxEventId!==event.outboxEventId)throw new Error('BONUS_OPPORTUNITY_SOURCE_MISMATCH');
    if(event.aggregateId!==opportunity.bonusOpportunityId) throw new Error('BONUS_OPPORTUNITY_SOURCE_MISMATCH');
    const delivery=await tx.notificationDelivery.findUniqueOrThrow({where:{personId_channel_notificationType_evidenceHash:{personId:opportunity.personId,channel:'LINE',notificationType:'BONUS_OPPORTUNITY',evidenceHash:correction?payload.evidenceHash as string:opportunity.opportunityKey}}});
    const now=new Date();
    const finish=async(status:'SENT'|'FAILED'|'EXPIRED',failureCode?:string)=>{
      await tx.notificationDelivery.update({where:{notificationDeliveryId:delivery.notificationDeliveryId},data:{status,failureCode}});
      await tx.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PROCESSED',processedAt:now}});
    };
    if(['SENT','FAILED','EXPIRED'].includes(delivery.status)){await finish(delivery.status as 'SENT'|'FAILED'|'EXPIRED',delivery.failureCode??undefined);return null;}
    if(opportunity.reviewRequired&&!correction){await finish('EXPIRED','BONUS_OPPORTUNITY_SUPERSEDED');return null;}
    if(delivery.expiresAt&&delivery.expiresAt<=now){await finish('EXPIRED','LINE_RETRY_WINDOW_EXPIRED');return null;}
    if(!sender.configured){
      await tx.notificationDelivery.update({where:{notificationDeliveryId:delivery.notificationDeliveryId},data:{status:'CONFIGURATION_PENDING',failureCode:'LINE_SENDER_CONFIGURATION_PENDING'}});
      await tx.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PENDING',availableAt:new Date(now.getTime()+3600000)}});
      return null;
    }
    const bindings=await tx.identityLink.findMany({where:{personId:opportunity.personId,provider:'LINE',status:'ACTIVE',...(delivery.destinationBindingId?{identityLinkId:delivery.destinationBindingId}:{})},take:2});
    if(bindings.length!==1){await finish('FAILED',delivery.destinationBindingId?'LINE_BINDING_REVOKED':'LINE_BINDING_MISSING_OR_AMBIGUOUS');return null;}
    const binding=bindings[0];
    await tx.notificationDelivery.update({where:{notificationDeliveryId:delivery.notificationDeliveryId},data:{status:'PENDING',destinationBindingId:binding.identityLinkId,lastAttemptAt:now,attemptCount:{increment:1},expiresAt:delivery.expiresAt??new Date(now.getTime()+23*3600000),failureCode:null}});
    return {deliveryId:delivery.notificationDeliveryId,recipient:binding.providerSubject,message:correction?payload.message as string:opportunity.message};
  });
  if(!prepared||'lostLease' in prepared)return;
  const outcome=await sender.send({recipient:prepared.recipient,notificationType:'BONUS_OPPORTUNITY',correlationId:prepared.deliveryId,text:prepared.message});
  await withOutboxLease(db,lease,async tx=>{
    const now=new Date();
    const retry=outcome.kind==='RETRY';
    await tx.notificationDelivery.update({where:{notificationDeliveryId:prepared.deliveryId},data:outcome.kind==='SENT'?{status:'SENT',sentAt:now,providerCorrelation:outcome.providerCorrelation,failureCode:null}:{status:retry?'PENDING':'FAILED',failureCode:outcome.code}});
    await tx.outboxEvent.update({where:{outboxEventId:lease.outboxEventId},data:{processStatus:retry?'PENDING':'PROCESSED',processedAt:retry?null:now,availableAt:new Date(now.getTime()+Math.min(3600000,30000*2**Math.min(lease.attemptCount,7)))}});
  });
}

export async function pollBonusOpportunities(db:PrismaService,sender:LineNotificationSender=lineNotificationSender()) {
  const events=await db.outboxEvent.findMany({where:{eventType:{in:['BONUS_OPPORTUNITY_CREATED','BONUS_OPPORTUNITY_CORRECTED']},processStatus:{in:['PENDING','PROCESSING']},availableAt:{lte:new Date()}},orderBy:{createdAt:'asc'},take:20});
  for(const event of events){
    const lease=await claimOutboxLease(db,event);
    if(!lease)continue;
    try{await processBonusOpportunity(db,lease,sender);}catch(error){await releaseFailedOutboxLease(db,lease,error);}
  }
}
