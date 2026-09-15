import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { createHash } from 'crypto';
import { RuntimeRuleService } from '../rules/runtime-rule.service';
import { BonusQueryService } from './bonus-query.service';

@Injectable()
export class ReferralBonusService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly rules:RuntimeRuleService,
    private readonly query:BonusQueryService,
  ){}

  equalizationUnlockDepth(plan:string,directs:number){
    if(plan==='STARTER') return directs>=2?4:(directs>=1?3:0);
    if(plan==='ELITE'){
      if(directs>=4) return 6;
      if(directs===3) return 5;
      if(directs===2) return 4;
      if(directs===1) return 3;
      return 0;
    }
    if(plan==='LEADER'){
      if(directs>=4) return 7;
      if(directs===3) return 5;
      if(directs===2) return 4;
      if(directs===1) return 3;
      return 0;
    }
    return 0;
  }

  async settle(periodStart:Date,periodEnd:Date,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const existing=await tx.settlementBatch.findUnique({
        where:{
          settlementType_periodStart_periodEnd_ruleVersionCode:{
            settlementType:'REFERRAL_K0',periodStart,periodEnd,ruleVersionCode
          }
        }
      });
      if(existing?.status==='FINALIZED') return existing;

      const batch=existing ?? await tx.settlementBatch.create({
        data:{settlementType:'REFERRAL_K0',periodStart,periodEnd,ruleVersionCode,status:'DRAFT'}
      });

      const pendingDays=await this.rules.integer('award.pending.days','*',periodEnd,ruleVersionCode,tx);
      const poolRate=await this.rules.decimal('pool.referral.rate','*',periodEnd,ruleVersionCode,tx);
      const totalGpv=await this.query.totalGpv(tx,periodStart,periodEnd);

      const gpvEvents=await tx.pvLedger.findMany({
        where:{pvType:'GPV',eventType:'GPV_CREATED',occurredAt:{gte:periodStart,lt:periodEnd}},
        orderBy:{occurredAt:'asc'}
      });

      const theoryRows:Array<any>=[];

      for(const event of gpvEvents){
        const ancestors=await this.query.sponsorAncestors(tx,event.qualificationId,event.occurredAt,7);
        const g1=ancestors.find(a=>a.generation===1);
        if(!g1) continue;

        const g1Active=await this.query.isActiveAt(tx,g1.qualification_id,event.occurredAt);
        const g1Plan=await this.query.qualificationPlanAt(tx,g1.qualification_id,event.occurredAt);
        const g1Rate=await this.rules.decimal('referral.g1.rate',g1Plan,event.occurredAt,ruleVersionCode,tx);
        const g1Theory=g1Active?event.amount.mul(g1Rate):new Prisma.Decimal(0);

        if(g1Theory.gt(0)){
          theoryRows.push({
            awardType:'REFERRAL',
            recipientQualificationId:g1.qualification_id,
            sourceQualificationId:event.qualificationId,
            sourceEventId:event.eventId,
            generationNo:1,
            theoryAmount:g1Theory,
            activeSnapshot:true,
            effectiveDirectCountSnapshot:null,
            planLevelSnapshot:g1Plan,
            occurredAt:event.occurredAt,
            pendingUntil:this.query.pendingUntil(event.occurredAt,pendingDays),
            calculationDetail:{
              sourceGpv:event.amount.toString(),
              rate:g1Rate.toString(),
              generation:1
            }
          });
        }

        // Equalization exists only when same source transaction generated G1 referral bonus.
        if(g1Theory.lte(0)) continue;

        for(const anc of ancestors.filter(a=>a.generation>=2)){
          const plan=await this.query.qualificationPlanAt(tx,anc.qualification_id,event.occurredAt);
          const directCount=await this.query.effectiveDirectCountAt(tx,anc.qualification_id,event.occurredAt);
          const unlock=this.equalizationUnlockDepth(plan,directCount);
          const active=await this.query.isActiveAt(tx,anc.qualification_id,event.occurredAt);

          if(!active || anc.generation>unlock) continue;

          let rate:Prisma.Decimal;
          try{
            rate=await this.rules.decimal(
              'equalization.rate',
              `${plan}:G${anc.generation}`,
              event.occurredAt,ruleVersionCode,tx
            );
          }catch{
            continue;
          }

          const theory=g1Theory.mul(rate);
          if(theory.lte(0)) continue;

          theoryRows.push({
            awardType:'EQUALIZATION',
            recipientQualificationId:anc.qualification_id,
            sourceQualificationId:event.qualificationId,
            sourceEventId:event.eventId,
            generationNo:anc.generation,
            theoryAmount:theory,
            activeSnapshot:true,
            effectiveDirectCountSnapshot:directCount,
            planLevelSnapshot:plan,
            occurredAt:event.occurredAt,
            pendingUntil:this.query.pendingUntil(event.occurredAt,pendingDays),
            calculationDetail:{
              baseG1ReferralTheory:g1Theory.toString(),
              rate:rate.toString(),
              generation:anc.generation,
              unlockDepth:unlock,
              effectiveDirectCount:directCount
            }
          });
        }
      }

      const totalTheory=theoryRows.reduce((a,r)=>a.add(r.theoryAmount),new Prisma.Decimal(0));
      const poolAvailable=totalGpv.mul(poolRate);
      const k=totalTheory.gt(0)
        ? Prisma.Decimal.min(new Prisma.Decimal(1),poolAvailable.div(totalTheory))
        : new Prisma.Decimal(1);

      for(const row of theoryRows){
        const payable=row.theoryAmount.mul(k);
        const award=await tx.bonusAward.create({
          data:{
            settlementBatchId:batch.settlementBatchId,
            awardType:row.awardType,
            recipientQualificationId:row.recipientQualificationId,
            sourceQualificationId:row.sourceQualificationId,
            sourceEventId:row.sourceEventId,
            generationNo:row.generationNo,
            theoryAmount:row.theoryAmount,
            kFactor:k,
            payableAmount:payable,
            activeSnapshot:row.activeSnapshot,
            effectiveDirectCountSnapshot:row.effectiveDirectCountSnapshot,
            planLevelSnapshot:row.planLevelSnapshot,
            ruleVersionCode,
            occurredAt:row.occurredAt,
            pendingUntil:row.pendingUntil,
            calculationDetail:row.calculationDetail
          }
        });
        await tx.bonusAwardLifecycleEvent.createMany({
          data:[
            {bonusAwardId:award.bonusAwardId,status:'CALCULATED',occurredAt:new Date()},
            {bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:new Date()}
          ]
        });
      }

      const hash=createHash('sha256')
        .update(JSON.stringify({
          batch:batch.settlementBatchId,totalGpv:totalGpv.toString(),
          poolRate:poolRate.toString(),totalTheory:totalTheory.toString(),k:k.toString()
        })).digest('hex');

      return tx.settlementBatch.update({
        where:{settlementBatchId:batch.settlementBatchId},
        data:{
          status:'FINALIZED',totalGpv,poolRate,poolAvailable,totalTheory,kFactor:k,
          calculationHash:hash,finalizedAt:new Date()
        }
      });
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
