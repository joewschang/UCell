import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { randomUUID } from 'crypto';
import { RuntimeRuleService } from '../rules/runtime-rule.service';
import { BonusQueryService } from '../bonus/bonus-query.service';

@Injectable()
export class EpvService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly rules:RuntimeRuleService,
    private readonly query:BonusQueryService,
  ){}

  async recognizeOrder(orderId:string,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const order=await tx.order.findUnique({where:{orderId},include:{lines:true}});
      if(!order || order.status!=='PAID') return {skipped:'ORDER_NOT_PAID'};
      if(order.purpose!=='REPURCHASE') return {skipped:'NOT_REPURCHASE'};

      const already=await tx.pvLedger.findFirst({
        where:{sourceType:'ORDER',sourceId:orderId,pvType:'EPV',eventType:'EPV_CREATED'}
      });
      if(already) return {skipped:'ALREADY_RECOGNIZED',eventId:already.eventId};

      const at=order.paidAt ?? new Date();
      const base=await this.rules.decimal('epv.base_amount','*',at,ruleVersionCode,tx);
      const epvRate=await this.rules.decimal('epv.rate','*',at,ruleVersionCode,tx);
      const excess=Prisma.Decimal.max(new Prisma.Decimal(0),order.netAmount.sub(base));
      if(excess.lte(0)) return {skipped:'NO_EXCESS'};

      const epv=excess.mul(epvRate);
      const correlationId=randomUUID();
      const ledger=await tx.pvLedger.create({
        data:{
          qualificationId:order.qualificationId,pvType:'EPV',amount:epv,
          sourceType:'ORDER',sourceId:order.orderId,eventType:'EPV_CREATED',
          ruleVersionCode,parameterSnapshotHash:order.parameterSnapshotHash,
          occurredAt:at,correlationId
        }
      });

      const pendingDays=await this.rules.integer('award.pending.days','*',at,ruleVersionCode,tx);
      const selfRate=await this.rules.decimal('epv.self.rate','*',at,ruleVersionCode,tx);
      const selfActive=await this.query.isActiveAt(tx,order.qualificationId,at);
      if(selfActive){
        const amount=epv.mul(selfRate);
        const award=await tx.bonusAward.create({
          data:{
            awardType:'EPV',
            recipientQualificationId:order.qualificationId,
            sourceQualificationId:order.qualificationId,sourceEventId:ledger.eventId,generationNo:0,
            theoryAmount:amount,payableAmount:amount,kFactor:new Prisma.Decimal(1),
            activeSnapshot:true,planLevelSnapshot:await this.query.qualificationPlan(tx,order.qualificationId),
            ruleVersionCode,occurredAt:at,
            pendingUntil:this.query.pendingUntil(at,pendingDays),
            calculationDetail:{subtype:'EPV_SELF',epv:epv.toString(),rate:selfRate.toString()}
          }
        });
        await tx.bonusAwardLifecycleEvent.createMany({data:[
          {bonusAwardId:award.bonusAwardId,status:'CALCULATED',occurredAt:new Date()},
          {bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:new Date()}
        ]});
      }

      const uplines=await this.query.sponsorAncestors(tx,order.qualificationId,at,5);
      for(const u of uplines){
        const active=await this.query.isActiveAt(tx,u.qualification_id,at);
        if(!active) continue;
        const rate=await this.rules.decimal('epv.upline.rate',String(u.generation),at,ruleVersionCode,tx);
        const amount=epv.mul(rate);
        const award=await tx.bonusAward.create({
          data:{
            awardType:'EPV',
            recipientQualificationId:u.qualification_id,
            sourceQualificationId:order.qualificationId,sourceEventId:ledger.eventId,generationNo:u.generation,
            theoryAmount:amount,payableAmount:amount,kFactor:new Prisma.Decimal(1),
            activeSnapshot:true,
            effectiveDirectCountSnapshot:await this.query.effectiveDirectCountAt(tx,u.qualification_id,at),
            planLevelSnapshot:await this.query.qualificationPlan(tx,u.qualification_id),
            ruleVersionCode,occurredAt:at,
            pendingUntil:this.query.pendingUntil(at,pendingDays),
            calculationDetail:{subtype:'EPV_UPLINE',epv:epv.toString(),rate:rate.toString(),generation:u.generation}
          }
        });
        await tx.bonusAwardLifecycleEvent.createMany({data:[
          {bonusAwardId:award.bonusAwardId,status:'CALCULATED',occurredAt:new Date()},
          {bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:new Date()}
        ]});
      }

      return {orderId,excess:excess.toString(),epv:epv.toString(),eventId:ledger.eventId};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
