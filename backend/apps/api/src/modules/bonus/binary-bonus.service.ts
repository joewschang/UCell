import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { createHash } from 'crypto';
import { RuntimeRuleService } from '../rules/runtime-rule.service';
import { BonusQueryService } from './bonus-query.service';

@Injectable()
export class BinaryBonusService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly rules:RuntimeRuleService,
    private readonly query:BonusQueryService,
  ){}

  matchingUnlockDepth(directs:number){
    if(directs<=0) return 0;
    if(directs===1) return 2;
    if(directs===2) return 3;
    if(directs===3) return 4;
    return 5;
  }

  async sideGpv(
    tx:Prisma.TransactionClient,
    rootQualificationId:string,
    side:'LEFT'|'RIGHT',
    start:Date,end:Date
  ){
    const rows=await tx.$queryRaw<Array<{amount:string}>>`
      WITH RECURSIVE first_child AS (
        SELECT child_qualification_id AS qualification_id
        FROM organization.binary_placement
        WHERE parent_qualification_id=${rootQualificationId}::uuid
          AND side=${side}::organization."SideCode"
          AND effective_to IS NULL
      ),
      subtree AS (
        SELECT qualification_id FROM first_child
        UNION ALL
        SELECT bp.child_qualification_id
        FROM organization.binary_placement bp
        JOIN subtree s ON bp.parent_qualification_id=s.qualification_id
        WHERE bp.effective_to IS NULL
      )
      SELECT COALESCE(SUM(p.amount),0)::text AS amount
      FROM ledger.pv_ledger p
      JOIN subtree s ON p.qualification_id=s.qualification_id
      WHERE p.pv_type='GPV'::ledger."PvType"
        AND p.occurred_at >= ${start}
        AND p.occurred_at < ${end}
    `;
    return new Prisma.Decimal(rows[0]?.amount ?? '0');
  }

  async settleBinary(periodStart:Date,periodEnd:Date,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const existing=await tx.settlementBatch.findUnique({
        where:{
          settlementType_periodStart_periodEnd_ruleVersionCode:{
            settlementType:'BINARY_K1',periodStart,periodEnd,ruleVersionCode
          }
        }
      });
      if(existing?.status==='FINALIZED') return existing;

      const batch=existing ?? await tx.settlementBatch.create({
        data:{settlementType:'BINARY_K1',periodStart,periodEnd,ruleVersionCode}
      });

      const pendingDays=await this.rules.integer('award.pending.days','*',periodEnd,ruleVersionCode,tx);
      const poolRate=await this.rules.decimal('pool.binary.rate','*',periodEnd,ruleVersionCode,tx);
      const pairRate=await this.rules.decimal('binary.pair.rate','*',periodEnd,ruleVersionCode,tx);
      const totalGpv=await this.query.totalGpv(tx,periodStart,periodEnd);

      const qualifications=await tx.qualification.findMany({
        where:{effectiveAt:{lt:periodEnd}},
        select:{qualificationId:true}
      });

      const theoryRows:Array<any>=[];
      for(const q of qualifications){
        const effective=await this.query.isQualificationEffectiveAt(tx,q.qualificationId,periodEnd);
        if(!effective) continue;
        const active=await this.query.isActiveAt(tx,q.qualificationId,periodEnd);
        const planLevelCode=await this.query.qualificationPlanAt(tx,q.qualificationId,periodEnd);
        const previous=await tx.binaryCarry.findFirst({
          where:{qualificationId:q.qualificationId,periodEnd:{lt:periodEnd}},
          orderBy:{periodEnd:'desc'}
        });

        const leftIn=previous?.leftCarryOut ?? new Prisma.Decimal(0);
        const rightIn=previous?.rightCarryOut ?? new Prisma.Decimal(0);
        const leftPeriod=await this.sideGpv(tx,q.qualificationId,'LEFT',periodStart,periodEnd);
        const rightPeriod=await this.sideGpv(tx,q.qualificationId,'RIGHT',periodStart,periodEnd);
        const leftAvailable=leftIn.add(leftPeriod);
        const rightAvailable=rightIn.add(rightPeriod);

        const cap=await this.rules.decimal('binary.weekly.cap',planLevelCode,periodEnd,ruleVersionCode,tx);
        const rawPair=Prisma.Decimal.min(leftAvailable,rightAvailable);
        const paired=Prisma.Decimal.min(rawPair,cap);

        await tx.binaryCarry.create({
          data:{
            qualificationId:q.qualificationId,periodEnd,
            leftCarryIn:leftIn,rightCarryIn:rightIn,
            leftPeriodGpv:leftPeriod,rightPeriodGpv:rightPeriod,
            pairedPv:paired,
            leftCarryOut:leftAvailable.sub(paired),
            rightCarryOut:rightAvailable.sub(paired),
            weeklyCapSnapshot:cap,ruleVersionCode
          }
        });

        const theory=active?paired.mul(pairRate):new Prisma.Decimal(0);
        if(theory.gt(0)){
          theoryRows.push({
            recipientQualificationId:q.qualificationId,
            theoryAmount:theory,
            activeSnapshot:true,
            planLevelSnapshot:planLevelCode,
            occurredAt:periodEnd,
            pendingUntil:this.query.pendingUntil(periodEnd,pendingDays),
            calculationDetail:{
              leftCarryIn:leftIn.toString(),rightCarryIn:rightIn.toString(),
              leftPeriodGpv:leftPeriod.toString(),rightPeriodGpv:rightPeriod.toString(),
              pairedPv:paired.toString(),pairRate:pairRate.toString(),
              weeklyCap:cap.toString()
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
        const award=await tx.bonusAward.create({
          data:{
            settlementBatchId:batch.settlementBatchId,
            awardType:'BINARY',
            recipientQualificationId:row.recipientQualificationId,
            theoryAmount:row.theoryAmount,kFactor:k,payableAmount:row.theoryAmount.mul(k),
            activeSnapshot:true,planLevelSnapshot:row.planLevelSnapshot,
            ruleVersionCode,occurredAt:periodEnd,pendingUntil:row.pendingUntil,
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

  async settleMatching(periodStart:Date,periodEnd:Date,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const binaryBatch=await tx.settlementBatch.findUnique({
        where:{
          settlementType_periodStart_periodEnd_ruleVersionCode:{
            settlementType:'BINARY_K1',periodStart,periodEnd,ruleVersionCode
          }
        }
      });
      if(!binaryBatch || binaryBatch.status!=='FINALIZED')
        throw new Error('Binary K1 must be finalized before Matching');

      const existing=await tx.settlementBatch.findUnique({
        where:{
          settlementType_periodStart_periodEnd_ruleVersionCode:{
            settlementType:'MATCHING_K2',periodStart,periodEnd,ruleVersionCode
          }
        }
      });
      if(existing?.status==='FINALIZED') return existing;

      const batch=existing ?? await tx.settlementBatch.create({
        data:{settlementType:'MATCHING_K2',periodStart,periodEnd,ruleVersionCode}
      });

      const pendingDays=await this.rules.integer('award.pending.days','*',periodEnd,ruleVersionCode,tx);
      const poolRate=await this.rules.decimal('pool.matching.rate','*',periodEnd,ruleVersionCode,tx);
      const totalGpv=await this.query.totalGpv(tx,periodStart,periodEnd);

      const binaryAwards=await tx.bonusAward.findMany({
        where:{settlementBatchId:binaryBatch.settlementBatchId,awardType:'BINARY',payableAmount:{gt:0}}
      });

      const rows:Array<any>=[];
      for(const source of binaryAwards){
        const uplines=await this.query.sponsorAncestors(tx,source.recipientQualificationId,periodEnd,5);
        for(const u of uplines){
          const directCount=await this.query.effectiveDirectCountAt(tx,u.qualification_id,periodEnd);
          const unlock=this.matchingUnlockDepth(directCount);
          const active=await this.query.isActiveAt(tx,u.qualification_id,periodEnd);
          if(!active || u.generation>unlock) continue;

          const rate=await this.rules.decimal('matching.rate',String(u.generation),periodEnd,ruleVersionCode,tx);
          const theory=source.payableAmount.mul(rate); // actual Binary Paid after K1
          if(theory.lte(0)) continue;

          rows.push({
            recipientQualificationId:u.qualification_id,
            sourceQualificationId:source.recipientQualificationId,
            sourceAwardId:source.bonusAwardId,
            generationNo:u.generation,
            theoryAmount:theory,
            activeSnapshot:true,
            effectiveDirectCountSnapshot:directCount,
            planLevelSnapshot:await this.query.qualificationPlanAt(tx,u.qualification_id,periodEnd),
            occurredAt:periodEnd,
            pendingUntil:this.query.pendingUntil(periodEnd,pendingDays),
            calculationDetail:{
              sourceBinaryPaid:source.payableAmount.toString(),
              rate:rate.toString(),generation:u.generation,
              unlockDepth:unlock,effectiveDirectCount:directCount
            }
          });
        }
      }

      const totalTheory=rows.reduce((a,r)=>a.add(r.theoryAmount),new Prisma.Decimal(0));
      const poolAvailable=totalGpv.mul(poolRate);
      const k=totalTheory.gt(0)
        ? Prisma.Decimal.min(new Prisma.Decimal(1),poolAvailable.div(totalTheory))
        : new Prisma.Decimal(1);

      for(const row of rows){
        const award=await tx.bonusAward.create({
          data:{
            settlementBatchId:batch.settlementBatchId,awardType:'MATCHING',
            recipientQualificationId:row.recipientQualificationId,
            sourceQualificationId:row.sourceQualificationId,
            sourceAwardId:row.sourceAwardId,generationNo:row.generationNo,
            theoryAmount:row.theoryAmount,kFactor:k,payableAmount:row.theoryAmount.mul(k),
            activeSnapshot:true,effectiveDirectCountSnapshot:row.effectiveDirectCountSnapshot,
            planLevelSnapshot:row.planLevelSnapshot,ruleVersionCode,
            occurredAt:periodEnd,pendingUntil:row.pendingUntil,
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
