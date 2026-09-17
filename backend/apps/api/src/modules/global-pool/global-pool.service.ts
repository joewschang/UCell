import { SettlementCalendarService } from '../settlement/settlement-calendar.service';
import { snapshotDecimal } from '../rules/parameter-snapshot';
import { Injectable } from '@nestjs/common';
import { GlobalRankCode, Prisma, PrismaService } from '@ucell/database';
import { RuntimeRuleService } from '../rules/runtime-rule.service';
import { BonusQueryService } from '../bonus/bonus-query.service';
import { calculateGlobalPool, GlobalRankSliceInput } from './global-pool-calculation';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { GlobalPoolPersistence, GlobalPoolAwardWrite } from './global-pool-persistence';

const LEVELS:GlobalRankCode[]=['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'];

@Injectable()
export class GlobalPoolService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly rules:RuntimeRuleService,
    private readonly query:BonusQueryService,
    private readonly calendar:SettlementCalendarService,
    private readonly persistence:GlobalPoolPersistence,
  ){}

  async weakSidePv(tx:Prisma.TransactionClient,qualificationId:string,start:Date,end:Date){
    const side=async(side:'LEFT'|'RIGHT')=>{
      const rows=await tx.$queryRaw<Array<{amount:string}>>`
        WITH RECURSIVE first_child AS (
          SELECT child_qualification_id AS qualification_id
          FROM organization.binary_placement
          WHERE parent_qualification_id=${qualificationId}::uuid
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
          AND p.occurred_at>=${start} AND p.occurred_at<${end}
      `;
      return new Prisma.Decimal(rows[0]?.amount ?? '0');
    };
    return Prisma.Decimal.min(await side('LEFT'),await side('RIGHT'));
  }

  async evaluateAndSettle(periodStart:Date,periodEnd:Date,ruleVersionCode='R1.0B'){
    try {
      return await this.prisma.$transaction(async tx=>{
      const existing=await this.persistence.verifiedExisting(tx,periodStart,periodEnd,ruleVersionCode);
      if(existing) return existing;
      const parameterSnapshot=await this.calendar.captureForPeriod(tx,periodStart,periodEnd,'GLOBAL',ruleVersionCode);

      const totalGpv=await this.query.totalGpv(tx,periodStart,periodEnd);
      const poolRate=snapshotDecimal(parameterSnapshot,'pool.global.rate','*');
      const poolAvailable=totalGpv.mul(poolRate);

      const qs=await tx.qualification.findMany({
        where:{effectiveAt:{lt:periodEnd}},
        select:{qualificationId:true}
      });

      const weakMap=new Map<string,Prisma.Decimal>();
      for(const q of qs){
        weakMap.set(q.qualificationId,await this.weakSidePv(tx,q.qualificationId,periodStart,periodEnd));
      }

      // Rank is historical achievement: once passed, never downgraded.
      for(const q of qs){
        const weak=weakMap.get(q.qualificationId)!;
        for(const level of LEVELS){
          const threshold=snapshotDecimal(parameterSnapshot,'global.rank.weak_threshold',level);
          if(weak.gte(threshold)){
            await tx.qualificationGlobalRankHistory.upsert({
              where:{qualificationId_rankCode:{qualificationId:q.qualificationId,rankCode:level}},
              update:{},
              create:{
                qualificationId:q.qualificationId,rankCode:level,
                achievedAt:periodEnd,sourcePeriodEnd:periodEnd,ruleVersionCode
              }
            });
          }
        }
      }

      const sliceInputs:GlobalRankSliceInput[]=[];

      for(const level of LEVELS){
        const rate=snapshotDecimal(parameterSnapshot,'global.rank.pool_rate',level);
        const threshold=snapshotDecimal(parameterSnapshot,'global.rank.weak_threshold',level);

        const eligible:string[]=[];
        for(const q of qs){
          const active=await this.query.isActiveAt(tx,q.qualificationId,periodEnd);
          if(!active) continue;
          const weak=weakMap.get(q.qualificationId)!;
          if(weak.lt(threshold)) continue;
          const achieved=await tx.qualificationGlobalRankHistory.findUnique({
            where:{qualificationId_rankCode:{qualificationId:q.qualificationId,rankCode:level}}
          });
          if(achieved) eligible.push(q.qualificationId);
        }
        sliceInputs.push({level,rate,eligibleQualificationIds:eligible});
      }

      const calculation=calculateGlobalPool(totalGpv,poolAvailable,sliceInputs);
      const awards:GlobalPoolAwardWrite[]=[];
      for(const slice of calculation.slices){
        if(slice.amountPerRecipient===null) continue;
        for(const qid of slice.eligibleQualificationIds){
          awards.push({
              qualificationId:qid,rankLevel:slice.level,rankPoolRate:slice.rate,
              rankPoolAmount:slice.amount,eligibleCount:slice.eligibleQualificationIds.length,
              payableAmount:slice.amountPerRecipient,weakSidePvSnapshot:weakMap.get(qid)!,
          });
        }
      }
      return this.persistence.persist(tx,{
        settlementId:randomUUID(), periodStart, periodEnd, totalGpv, poolRate, poolAvailable,
        distributedAmount:calculation.distributedAmount,
        undistributedAmount:calculation.undistributedAmount,
        ruleVersionCode,
        parameterSnapshot:parameterSnapshot as unknown as Prisma.InputJsonValue,
        awards,
      });
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    } catch (error) {
      if ((error as {code?:string}).code === 'P2002' || (error as {code?:string}).code === 'P2034') {
        return this.prisma.$transaction(tx=>this.persistence.verifiedExisting(tx,periodStart,periodEnd,ruleVersionCode)
          .then(existing=>{ if (!existing) throw error; return existing; }));
      }
      throw error;
    }
  }

  async accrueWelfare(periodStart:Date,periodEnd:Date,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const existing=await tx.welfarePoolAccrual.findUnique({
        where:{periodStart_periodEnd_ruleVersionCode:{periodStart,periodEnd,ruleVersionCode}}
      });
      if(existing) return existing;
      const parameterSnapshot=await this.calendar.captureForPeriod(tx,periodStart,periodEnd,'WELFARE',ruleVersionCode);
      const totalGpv=await this.query.totalGpv(tx,periodStart,periodEnd);
      const rate=snapshotDecimal(parameterSnapshot,'pool.welfare.rate','*');
      const accrual=await tx.welfarePoolAccrual.create({
        data:{periodStart,periodEnd,totalGpv,poolRate:rate,accruedAmount:totalGpv.mul(rate),ruleVersionCode,parameterSnapshot:parameterSnapshot as unknown as Prisma.InputJsonValue}
      });
      const idempotencyKey=`welfare:initial:${accrual.welfarePoolAccrualId}`;
      await tx.welfarePoolEffect.create({data:{welfarePoolAccrualId:accrual.welfarePoolAccrualId,effectType:'INITIAL_ACCRUAL',amount:accrual.accruedAmount,
        ruleVersionCode,idempotencyKey,evidenceHash:createHash('sha256').update(JSON.stringify({kind:'WELFARE_INITIAL_ACCRUAL',sourceId:accrual.welfarePoolAccrualId,amount:accrual.accruedAmount.toFixed(4),ruleVersionCode})).digest('hex')}});
      return accrual;
    });
  }
}
