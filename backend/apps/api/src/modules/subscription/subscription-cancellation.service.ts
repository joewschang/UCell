import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { randomUUID } from 'crypto';

@Injectable()
export class SubscriptionCancellationService {
  constructor(private readonly prisma:PrismaService){}

  async cancel(subscriptionId:string,effectiveAt:Date,reasonCode:string,refundAmount='0',input:{sourceReturnCaseId?:string;idempotencyKey?:string}={}){
    const existingWhere=input.sourceReturnCaseId
      ?{sourceReturnCaseId:input.sourceReturnCaseId}
      :input.idempotencyKey?{idempotencyKey:input.idempotencyKey}:null;
    try{return await this.prisma.$transaction(async tx=>{
      const existing=existingWhere?await tx.subscriptionCancellation.findFirst({where:existingWhere}):null;
      if(existing) return {
        cancellation:existing,
        cancelledFutureCount:0,
        queuedRpvReversalCount:0,
        replayed:true
      };
      const sub=await tx.subscription.findUniqueOrThrow({
        where:{subscriptionId},include:{schedules:true}
      });
      if(input.sourceReturnCaseId){
        const sourceReturn=await tx.returnCase.findUnique({where:{returnCaseId:input.sourceReturnCaseId}});
        if(!sourceReturn||sourceReturn.status!=='POSTED'||sourceReturn.orderId!==sub.orderId) throw new ConflictException({code:'SUBSCRIPTION_CANCELLATION_RETURN_SOURCE_INVALID'});
      }
      const correlationId=randomUUID();

      const fact=await tx.subscriptionCancellation.create({
        data:{
          subscriptionId,requestedAt:new Date(),effectiveAt,reasonCode,
          refundAmount,sourceReturnCaseId:input.sourceReturnCaseId,idempotencyKey:input.idempotencyKey,correlationId,status:'POSTED'
        }
      });

      await tx.monthlyRecognitionSchedule.updateMany({
        where:{
          subscriptionId,
          dueAt:{gte:effectiveAt},
          status:'SCHEDULED'
        },
        data:{status:'CANCELLED'}
      });

      const recognized=await tx.monthlyRecognitionSchedule.findMany({
        where:{
          subscriptionId,
          status:'RECOGNIZED'
        }
      });

      for(const r of recognized){
        await tx.outboxEvent.create({
          data:{
            eventType:'RPV_REVERSAL_REQUIRED',
            aggregateType:'MONTHLY_RECOGNITION',
            aggregateId:r.recognitionId,
            payload:{
              subscriptionCancellationId:fact.subscriptionCancellationId,
              subscriptionId,recognitionId:r.recognitionId,
              reasonCode,ruleVersionCode:sub.ruleVersionCode
            },
            processStatus:'PENDING',availableAt:new Date(),correlationId
          }
        });
      }

      await tx.subscription.update({
        where:{subscriptionId},data:{status:'CANCELLED',cancelledAt:effectiveAt}
      });

      return {
        cancellation:fact,
        cancelledFutureCount:sub.schedules.filter(s=>s.status==='SCHEDULED' && s.dueAt>=effectiveAt).length,
        queuedRpvReversalCount:recognized.length,
        replayed:false
      };
    });}catch(error){
      // Concurrent retries race only on the append-only natural key.  Re-read
      // the committed fact; no existing cancellation or recovery event is
      // mutated to make the retry succeed.
      if((error as any)?.code!=='P2002') throw error;
      if(!existingWhere) throw error;
      const existing=await this.prisma.subscriptionCancellation.findFirst({where:existingWhere});
      if(!existing) throw error;
      return {cancellation:existing,cancelledFutureCount:0,queuedRpvReversalCount:0,replayed:true};
    }
  }
}
