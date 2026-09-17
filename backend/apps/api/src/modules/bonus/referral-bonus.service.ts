import { SettlementCalendarService } from '../settlement/settlement-calendar.service';
import { snapshotDecimal, verifySnapshot, captureParameters } from '../rules/parameter-snapshot';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, sealSettlement, effectiveGpv, verifyReplayEnvelope, historicalSponsorAncestors, historicalRecipientState } from '@ucell/database';
import { createHash } from 'crypto';
import { RuntimeRuleService } from '../rules/runtime-rule.service';
import { BonusQueryService } from './bonus-query.service';

@Injectable()
export class ReferralBonusService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly rules:RuntimeRuleService,
    private readonly query:BonusQueryService,
    private readonly calendar:SettlementCalendarService,
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

  equalizationMaximumDepth(plan:string){
    if(plan==='STARTER') return 4;
    if(plan==='ELITE') return 6;
    if(plan==='LEADER') return 7;
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

      const parameterSnapshot=existing?verifySnapshot(existing.parameterSnapshot):await this.calendar.captureForPeriod(tx,periodStart,periodEnd,'REFERRAL_K0',ruleVersionCode);
      const batch=existing ?? await tx.settlementBatch.create({
        data:{settlementType:'REFERRAL_K0',periodStart,periodEnd,ruleVersionCode,status:'DRAFT',parameterSnapshot:parameterSnapshot as unknown as Prisma.InputJsonValue}
      });

      const pendingDays=Number(snapshotDecimal(parameterSnapshot,'award.pending.days').toString());
      const poolRate=snapshotDecimal(parameterSnapshot,'pool.referral.rate','*');

      const gpvEvents=await tx.pvLedger.findMany({
        where:{pvType:'GPV',eventType:'GPV_CREATED',ruleVersionCode,occurredAt:{gte:periodStart,lt:periodEnd}},
        orderBy:{occurredAt:'asc'}
      });

      const sources=[];
      for(const event of gpvEvents) sources.push(verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'GPV',sourceId:event.eventId}}})));
      const effective=await effectiveGpv(tx,sources);
      const totalGpv=[...effective.values()].reduce((sum,value)=>sum.add(value),new Prisma.Decimal(0));
      const theoryRows:Array<any>=[];

      for(const event of gpvEvents){
        const source=verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'GPV',sourceId:event.eventId}}}));
        const sourceSnapshot=source.parameters;
        const ancestors=historicalSponsorAncestors(source.evidence,event.qualificationId,7);
        const g1=ancestors.find(a=>a.generation===1);
        if(!g1) continue;

        const g1Active=historicalRecipientState(source.evidence,g1.qualification_id).active;
        const g1Plan=historicalRecipientState(source.evidence,g1.qualification_id).plan;
        const g1Rate=snapshotDecimal(sourceSnapshot,'referral.g1.rate',g1Plan);
        // Matching generations are fixed historical sponsor positions.  Their
        // base is the G1 referral theory for this source, independent of
        // whether G1 itself is entitled to an award.
        const g1ReferralTheory=effective.get(event.eventId)!.mul(g1Rate);
        const g1Theory=g1Active?g1ReferralTheory:new Prisma.Decimal(0);

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
              parameterSnapshot:sourceSnapshot,
              sourceGpv:effective.get(event.eventId)!.toString(),
              originalCalculationSourceVolume:effective.get(event.eventId)!.toString(),
              rate:g1Rate.toString(),
              generation:1
            }
          });
        }

        if(!g1Active && g1ReferralTheory.gt(0)){
          await tx.bonusCalculationEvidence.createMany({data:[{
            settlementBatchId:batch.settlementBatchId,evidenceType:'REFERRAL_ELIGIBILITY',
            recipientQualificationId:g1.qualification_id,reasonCode:'INACTIVE',
            theoreticalAmount:g1ReferralTheory,entitlementAmount:new Prisma.Decimal(0),
            ruleVersionCode,parameterSnapshotHash:sourceSnapshot.hash,occurredAt:event.occurredAt,
            calculationDetail:{sourceEventId:event.eventId,generation:1,rate:g1Rate.toString(),sourceGpv:effective.get(event.eventId)!.toString()}
          }],skipDuplicates:true});
        }

        for(const anc of ancestors.filter(a=>a.generation>=2)){
          const plan=historicalRecipientState(source.evidence,anc.qualification_id).plan;
          const directCount=historicalRecipientState(source.evidence,anc.qualification_id).directs;
          const unlock=this.equalizationUnlockDepth(plan,directCount);
          const active=historicalRecipientState(source.evidence,anc.qualification_id).active;

          // A plan has no rate outside its configured fixed generation range.
          if(anc.generation>this.equalizationMaximumDepth(plan)) continue;

          const rate=snapshotDecimal(sourceSnapshot,'equalization.rate',`${plan}:G${anc.generation}`);
          const theoreticalAmount=g1ReferralTheory.mul(rate);
          if(!active || anc.generation>unlock){
            await tx.bonusCalculationEvidence.createMany({data:[{
              settlementBatchId:batch.settlementBatchId,evidenceType:'REFERRAL_MATCHING_ELIGIBILITY',
              recipientQualificationId:anc.qualification_id,reasonCode:!active?'INACTIVE':'LOCKED',
              theoreticalAmount,entitlementAmount:new Prisma.Decimal(0),ruleVersionCode,
              parameterSnapshotHash:sourceSnapshot.hash,occurredAt:event.occurredAt,
              calculationDetail:{sourceEventId:event.eventId,baseG1ReferralTheory:g1ReferralTheory.toString(),rate:rate.toString(),generation:anc.generation,unlockDepth:unlock,effectiveDirectCount:directCount}
            }],skipDuplicates:true});
            continue;
          }

          const theory=theoreticalAmount;
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
              parameterSnapshot:sourceSnapshot,
              baseG1ReferralTheory:g1ReferralTheory.toString(),
              originalCalculationSourceVolume:effective.get(event.eventId)!.toString(),
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
            ruleVersionCode,parameterSnapshotHash:row.calculationDetail.parameterSnapshot.hash,
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

      const finalized=await tx.settlementBatch.update({
        where:{settlementBatchId:batch.settlementBatchId},
        data:{
          status:'FINALIZED',totalGpv,poolRate,poolAvailable,totalTheory,kFactor:k,
          calculationHash:hash,finalizedAt:new Date()
        }
      });
      await sealSettlement(tx,finalized);
      return finalized;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
