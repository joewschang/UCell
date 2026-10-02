import {Prisma} from '@prisma/client';
import {verifyReplayEnvelope} from './historical-replay';
import {erpBusinessReference} from './erp-business-projection';
import {appendMemberMessage} from './member-message';
/** Called only after an actual API/Worker recognition write, within its existing transaction. */
export async function appendRecognitionMemberMessage(tx:Prisma.TransactionClient,recognitionId:string){
 const row=await tx.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId},include:{subscription:true}});
 if(row.status!=='RECOGNIZED'||!row.recognizedAt||row.recognizedAt>new Date()||!row.pvLedgerEventId)throw new Error('RECOGNITION_MESSAGE_SOURCE_INVALID');
 const [pv,stored]=await Promise.all([tx.pvLedger.findUnique({where:{eventId:row.pvLedgerEventId}}),tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'RPV',sourceId:recognitionId}}})]);
 const seal=verifyReplayEnvelope(stored);
 if(!pv||pv.eventType!=='RPV_CREATED'||pv.pvType!=='RPV'||pv.qualificationId!==row.subscription.qualificationId||pv.sourceId!==row.subscriptionId||pv.sourceLineId!==recognitionId||seal.kind!=='RPV'||seal.sourceId!==recognitionId||seal.inputs.eventId!==pv.eventId||seal.inputs.subscriptionId!==row.subscriptionId||seal.at!==pv.occurredAt.toISOString()||pv.occurredAt.getTime()!==row.dueAt.getTime()||pv.ruleVersionCode!==row.ruleVersionCode||seal.ruleVersionCode!==row.ruleVersionCode||seal.inputs.volume!==pv.amount.toString())throw new Error('RECOGNITION_MESSAGE_SOURCE_INVALID');
 await tx.$queryRaw(Prisma.sql`SELECT qualification_id FROM membership.qualification WHERE qualification_id=${row.subscription.qualificationId}::uuid FOR UPDATE`);
 const q=await tx.qualification.findUniqueOrThrow({where:{qualificationId:row.subscription.qualificationId},select:{qualificationNo:true,currentHolderPersonId:true,kind:true}});
 if(q.kind!=='MEMBER_ORIGIN')return null;
 const messageKey=`repurchase:recognized:${recognitionId}`,reference=erpBusinessReference('RECOGNITION',recognitionId),existing=await tx.memberNotification.findUnique({where:{messageKey}});
 if(existing){if(existing.qualificationId!==row.subscription.qualificationId||existing.category!=='REPURCHASE'||existing.sourceReference!==reference)throw new Error('RECOGNITION_MESSAGE_AUDIENCE_CONFLICT');return existing;}
 if(!q.currentHolderPersonId)return null;
 return appendMemberMessage(tx,{messageKey,personId:q.currentHolderPersonId,qualificationId:row.subscription.qualificationId,category:'REPURCHASE',title:'重銷逐期認列已完成',body:`資格 ${q.qualificationNo} 的重銷方案第 ${row.installmentNo} 期（${row.recognitionMonth.toISOString().slice(0,7)}）已完成認列。請至重銷方案查看目前紀錄；認列不代表獎金或付款完成。`,sourceType:'MONTHLY_RECOGNITION',sourceReference:reference,deepLink:'/repurchase',publishedAt:row.recognizedAt});
}
