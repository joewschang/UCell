import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { OutboxService } from '../../common/outbox/outbox.service';
import { CreateReturnDto } from './dto/create-return.dto';

@Injectable()
export class ReturnService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly idempotency:IdempotencyService,
    private readonly audit:AuditService,
    private readonly outbox:OutboxService,
  ){}

  async post(orderId:string,dto:CreateReturnDto,key:string,requestId:string,actorId?:string){
    const correlationId=randomUUID();
    return this.idempotency.execute(`admin:return:${orderId}`,key,dto,async tx=>{
      const order=await tx.order.findUnique({
        where:{orderId},include:{lines:true}
      });
      if(!order) throw new ConflictException({code:'RESOURCE_NOT_FOUND',message:'訂單不存在。'});
      if(!['PAID','FULFILLED','PARTIAL_RETURN'].includes(order.status))
        throw new ConflictException({code:'ORDER_LOCKED',message:'只有已付款/已出貨訂單可退貨。'});

      if(new Set(dto.lines.map(line=>line.orderLineId)).size!==dto.lines.length)
        throw new UnprocessableEntityException({code:'DUPLICATE_RETURN_LINE',message:'Each original line may appear only once per return event.'});
      const reused=await tx.returnCase.findUnique({where:{idempotencyKey:key}});
      if(reused) throw new ConflictException({code:'IDEMPOTENCY_KEY_REUSED',message:'Return event key already belongs to a posted event.'});
      const previous=await tx.returnLine.aggregate({where:{returnCase:{orderId,status:'POSTED'}},_sum:{returnAmount:true}});
      const previouslyReturned=previous._sum.returnAmount??new Prisma.Decimal(0);
      const ret=await tx.returnCase.create({
        data:{
          orderId,status:'POSTED',reasonCode:dto.reasonCode,
          occurredAt:new Date(dto.occurredAt),postedAt:new Date(),
          idempotencyKey:key,correlationId
        }
      });

      if(!order.paidAt) throw new UnprocessableEntityException({
        code:'HISTORICAL_SNAPSHOT_MISSING',message:'Original order recognition timestamp is required for settlement replay.'
      });
      const affectedSettlements=await tx.settlementBatch.findMany({
        where:{
          settlementType:{in:['BINARY_K1','MATCHING_K2']},status:'FINALIZED',
          ruleVersionCode:order.ruleVersionCode,periodStart:{lte:order.paidAt},periodEnd:{gt:order.paidAt}
        },
        select:{settlementType:true,periodStart:true,periodEnd:true}
      });
      if(affectedSettlements.length) await tx.settlementRecalculationRequest.createMany({
        data:affectedSettlements.map(batch=>({
          sourceReturnCaseId:ret.returnCaseId,settlementType:batch.settlementType,
          periodStart:batch.periodStart,periodEnd:batch.periodEnd,
          impactedQualificationId:order.qualificationId,status:'PENDING'
        })),skipDuplicates:true
      });

      let totalReturn=new Prisma.Decimal(0);
      for(const input of dto.lines){
        const line=order.lines.find(x=>x.orderLineId===input.orderLineId);
        if(!line) throw new UnprocessableEntityException({
          code:'DOMAIN_RULE_VIOLATION',message:'退貨明細不屬於此訂單。'
        });
        const qty=new Prisma.Decimal(input.quantity);
        if(qty.lte(0) || qty.gt(line.quantity))
          throw new UnprocessableEntityException({
            code:'DOMAIN_RULE_VIOLATION',message:'退貨數量超過原訂單數量。'
          });

        const already=await tx.returnLine.aggregate({
          where:{orderLineId:line.orderLineId,returnCase:{status:'POSTED'}},
          _sum:{quantity:true}
        });
        const returnedQty=already._sum.quantity ?? new Prisma.Decimal(0);
        if(returnedQty.add(qty).gt(line.quantity))
          throw new UnprocessableEntityException({
            code:'DOMAIN_RULE_VIOLATION',message:'累積退貨數量超過原訂單數量。'
          });

        const ratio=qty.div(line.quantity);
        const returnAmount=line.lineAmount.mul(ratio);
        const gpvReversal=line.gpvAmountSnapshot.mul(ratio);
        totalReturn=totalReturn.add(returnAmount);

        await tx.returnLine.create({
          data:{
            returnCaseId:ret.returnCaseId,orderLineId:line.orderLineId,
            quantity:qty,returnAmount,gpvReversalAmount:gpvReversal
          }
        });
      }

      const cumulativeReturn=previouslyReturned.add(totalReturn);
      if(cumulativeReturn.gt(order.netAmount))
        throw new UnprocessableEntityException({code:'RETURN_AMOUNT_EXCEEDED',message:'Cumulative returns exceed the original effective transaction amount.'});
      const fullReturn=cumulativeReturn.eq(order.netAmount);
      await tx.order.update({
        where:{orderId},
        data:{status:fullReturn?'RETURNED':'PARTIAL_RETURN'}
      });

      await this.outbox.enqueue(tx,{
        eventType:'RETURN_CONFIRMED',aggregateType:'RETURN',
        aggregateId:ret.returnCaseId,correlationId,
        payload:{
          eventType:'RETURN_CONFIRMED',
          returnCaseId:ret.returnCaseId,orderId,
          qualificationId:order.qualificationId,
          occurredAt:dto.occurredAt,
          ruleVersionCode:order.ruleVersionCode
        }
      });

      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'RETURN_POSTED',entityType:'RETURN_CASE',
        entityId:ret.returnCaseId,
        afterData:{orderId,totalReturn:totalReturn.toString(),lineCount:dto.lines.length},
        requestId,correlationId
      });

      return tx.returnCase.findUniqueOrThrow({
        where:{returnCaseId:ret.returnCaseId},include:{lines:true}
      });
    });
  }
}
