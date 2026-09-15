import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { randomUUID } from 'crypto';

@Injectable()
export class SubscriptionCancellationService {
  constructor(private readonly prisma:PrismaService){}

  async cancel(subscriptionId:string,effectiveAt:Date,reasonCode:string,refundAmount='0'){
    return this.prisma.$transaction(async tx=>{
      const sub=await tx.subscription.findUniqueOrThrow({
        where:{subscriptionId},include:{schedules:true}
      });
      const correlationId=randomUUID();

      const fact=await tx.subscriptionCancellation.create({
        data:{
          subscriptionId,requestedAt:new Date(),effectiveAt,reasonCode,
          refundAmount,correlationId,status:'POSTED'
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
          dueAt:{gte:effectiveAt},
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
        queuedRpvReversalCount:recognized.length
      };
    });
  }
}
