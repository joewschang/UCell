import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash } from 'node:crypto';

export const LINE_NOTIFICATION_TYPES=Object.freeze(['BINDING','ORDER','SHIPMENT','RETURN','SETTLEMENT','PAYOUT','ACTIVE_EXPIRY','LINE_REBIND','BANK_ACCOUNT_CHANGE','ANNOUNCEMENT'] as const);
export type LineNotificationType=typeof LINE_NOTIFICATION_TYPES[number];
@Injectable()
export class NotificationDeliveryService {
 constructor(private readonly db:PrismaService){}
 async queue(input:{personId:string;bindingId?:string;type:string;sourceReference:string;expiresAt?:Date}){
  if(!LINE_NOTIFICATION_TYPES.includes(input.type as LineNotificationType))throw new UnprocessableEntityException({code:'LINE_NOTIFICATION_TYPE_NOT_ALLOWED'});
  const evidenceHash=createHash('sha256').update(`${input.type}\n${input.sourceReference}`).digest('hex');
  return this.db.notificationDelivery.create({data:{personId:input.personId,channel:'LINE',notificationType:input.type,destinationBindingId:input.bindingId,status:'CONFIGURATION_PENDING',evidenceHash,expiresAt:input.expiresAt}});
 }
}
