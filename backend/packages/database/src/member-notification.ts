import { PrismaClient } from '@prisma/client';
import { OutboxLease, withOutboxLease } from './outbox-lease';
import { pending } from './parameter-snapshot';
/** Order creation notice only; never payment, fulfillment or monetary recognition. */
export async function processMemberOrderNotification(db:PrismaClient,lease:OutboxLease){
 return withOutboxLease(db,lease,async tx=>{
  const event=await tx.outboxEvent.findUniqueOrThrow({where:{outboxEventId:lease.outboxEventId}});
  const payload=event.payload as Record<string,unknown>;
  if(event.eventType!=='MEMBER_ORDER_CREATED'||!payload||![payload.personId,payload.qualificationId,payload.orderId].every(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v)))pending('OUTBOX_PAYLOAD_INVALID','Member order notification requires original audience/order evidence');
  const order=await tx.order.findUnique({where:{orderId:payload.orderId as string}});
  if(!order||order.orderId!==event.aggregateId||order.qualificationId!==payload.qualificationId)pending('OUTBOX_PAYLOAD_INVALID','Original order identity mismatch');
  const notice=await tx.memberNotification.upsert({where:{sourceEventId:event.outboxEventId},update:{},create:{sourceEventId:event.outboxEventId,personId:payload.personId as string,qualificationId:order.qualificationId,category:'ORDER',title:'訂單已建立',body:`訂單 ${order.orderId} 已建立。付款與配送狀態請以訂單紀錄為準。`}});
  if(notice.personId!==payload.personId||notice.qualificationId!==payload.qualificationId)pending('OUTBOX_PAYLOAD_INVALID','Previously posted notice audience mismatch');
  await tx.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date()}});
  return {notificationId:notice.notificationId};
 });
}
