import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, routeCompanyBonus, sealEpvEvent } from '@ucell/database';
import { randomUUID } from 'crypto';
import { RuntimeRuleService } from '../rules/runtime-rule.service';
import { BonusQueryService } from '../bonus/bonus-query.service';
import { captureParameters, snapshotDecimal, pending } from '../rules/parameter-snapshot';
import { EpvMonthService } from './epv-month.service';

@Injectable()
export class EpvService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly rules:RuntimeRuleService,
    private readonly query:BonusQueryService,
    private readonly months:EpvMonthService,
  ){}

  async recognizeOrder(orderId:string,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const order=await tx.order.findUnique({where:{orderId},include:{lines:true}});
      if(!order || !order.paidAt) return {skipped:'ORDER_NOT_PAID'};
      if(order.purpose!=='REPURCHASE') return {skipped:'NOT_REPURCHASE'};
      if(!order.qualificationId) return {skipped:'WEB_MEMBER_ORDER'};
      const qualificationId=order.qualificationId;
      if(order.ruleVersionCode!==ruleVersionCode) pending('RULE_VERSION_MISMATCH','Recognition must use the original order rule version');

      const already=await tx.pvLedger.findFirst({
        where:{sourceType:'ORDER',sourceId:orderId,pvType:'EPV',eventType:'EPV_CREATED'}
      });
      if(already) return {skipped:'ALREADY_RECOGNIZED',eventId:already.eventId};

      const at=order.paidAt;
      const snapshot=await captureParameters(tx,at,ruleVersionCode);
      const month=await this.months.recognition(tx,{...order,qualificationId},snapshot);
      const {base,rate:epvRate,epv}=month;
      const excess=Prisma.Decimal.max(new Prisma.Decimal(0),month.cumulative.sub(base));
      const correlationId=randomUUID();
      const ledger=await tx.pvLedger.create({
        data:{
          qualificationId:order.qualificationId,pvType:'EPV',amount:epv,
          sourceType:'ORDER',sourceId:order.orderId,eventType:'EPV_CREATED',
          ruleVersionCode,parameterSnapshotHash:snapshot.hash,
          occurredAt:at,correlationId
        }
      });

      await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'EPV_MONTH_RECOGNIZED',entityType:'ORDER',entityId:orderId,requestId:orderId,correlationId,
        afterData:{decisionId:'SA-20260915-02',monthStart:month.start.toISOString(),monthEnd:month.end.toISOString(),timezone:month.timezone,base:base.toString(),rate:epvRate.toString(),cumulative:month.cumulative.toString(),increment:epv.toString(),parameterSnapshot:snapshot as unknown as Prisma.InputJsonValue}}});
      // A zero event records threshold consumption and is an idempotent recognition marker.


      const pendingDays=Number(snapshotDecimal(snapshot,'award.pending.days').toString());
      const selfRate=snapshotDecimal(snapshot,'epv.self.rate');
      const selfActive=await this.query.isActiveAt(tx,order.qualificationId,at);
      {
        const amount=selfActive?epv.mul(selfRate):new Prisma.Decimal(0);
        const award=await tx.bonusAward.create({
          data:{
            awardType:'EPV',
            recipientQualificationId:order.qualificationId,
            sourceQualificationId:order.qualificationId,sourceEventId:ledger.eventId,generationNo:0,
            theoryAmount:amount,payableAmount:amount,kFactor:new Prisma.Decimal(1),
            activeSnapshot:selfActive,planLevelSnapshot:await this.query.qualificationPlanAt(tx,order.qualificationId,at),
            ruleVersionCode,parameterSnapshotHash:snapshot.hash,occurredAt:at,
            pendingUntil:this.query.pendingUntil(at,pendingDays),
            calculationDetail:{subtype:'EPV_SELF',epv:epv.toString(),rate:selfRate.toString()}
          }
        });
        if(!await routeCompanyBonus(tx,award,snapshot)) await tx.bonusAwardLifecycleEvent.createMany({data:[
          {bonusAwardId:award.bonusAwardId,status:'CALCULATED',occurredAt:new Date()},
          {bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:new Date()}
        ]});
      }

      const uplines=await this.query.sponsorAncestors(tx,order.qualificationId,at,5);
      for(const u of uplines){
        const active=await this.query.isActiveAt(tx,u.qualification_id,at);

        const rate=snapshotDecimal(snapshot,'epv.upline.rate',String(u.generation));
        const amount=active?epv.mul(rate):new Prisma.Decimal(0);
        const award=await tx.bonusAward.create({
          data:{
            awardType:'EPV',
            recipientQualificationId:u.qualification_id,
            sourceQualificationId:order.qualificationId,sourceEventId:ledger.eventId,generationNo:u.generation,
            theoryAmount:amount,payableAmount:amount,kFactor:new Prisma.Decimal(1),
            activeSnapshot:active,
            effectiveDirectCountSnapshot:await this.query.effectiveDirectCountAt(tx,u.qualification_id,at),
            planLevelSnapshot:await this.query.qualificationPlanAt(tx,u.qualification_id,at),
            ruleVersionCode,parameterSnapshotHash:snapshot.hash,occurredAt:at,
            pendingUntil:this.query.pendingUntil(at,pendingDays),
            calculationDetail:{subtype:'EPV_UPLINE',epv:epv.toString(),rate:rate.toString(),generation:u.generation}
          }
        });
        if(!await routeCompanyBonus(tx,award,snapshot)) await tx.bonusAwardLifecycleEvent.createMany({data:[
          {bonusAwardId:award.bonusAwardId,status:'CALCULATED',occurredAt:new Date()},
          {bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:new Date()}
        ]});
      }

      await sealEpvEvent(tx,ledger,snapshot,month,order);
      return {orderId,excess:excess.toString(),epv:epv.toString(),eventId:ledger.eventId};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
