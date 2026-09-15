import { Injectable } from '@nestjs/common';
import { GlobalRankCode, Prisma, PrismaService } from '@ucell/database';
import { RuntimeRuleService } from '../rules/runtime-rule.service';
import { BonusQueryService } from '../bonus/bonus-query.service';

const LEVELS:GlobalRankCode[]=['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'];

@Injectable()
export class GlobalPoolService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly rules:RuntimeRuleService,
    private readonly query:BonusQueryService,
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
    return this.prisma.$transaction(async tx=>{
      const existing=await tx.globalPoolSettlement.findUnique({
        where:{periodStart_periodEnd_ruleVersionCode:{periodStart,periodEnd,ruleVersionCode}}
      });
      if(existing) return existing;

      const totalGpv=await this.query.totalGpv(tx,periodStart,periodEnd);
      const poolRate=await this.rules.decimal('pool.global.rate','*',periodEnd,ruleVersionCode,tx);
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
          const threshold=await this.rules.decimal('global.rank.weak_threshold',level,periodEnd,ruleVersionCode,tx);
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

      const settlement=await tx.globalPoolSettlement.create({
        data:{
          periodStart,periodEnd,totalGpv,poolRate,poolAvailable,
          distributedAmount:new Prisma.Decimal(0),
          undistributedAmount:new Prisma.Decimal(0),
          ruleVersionCode
        }
      });

      let distributed=new Prisma.Decimal(0);
      let carryToHigher=new Prisma.Decimal(0);

      for(const level of LEVELS){
        const rate=await this.rules.decimal('global.rank.pool_rate',level,periodEnd,ruleVersionCode,tx);
        const threshold=await this.rules.decimal('global.rank.weak_threshold',level,periodEnd,ruleVersionCode,tx);
        const rankPool=totalGpv.mul(rate).add(carryToHigher);

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

        if(eligible.length===0){
          carryToHigher=rankPool;
          continue;
        }

        const each=rankPool.div(eligible.length);
        for(const qid of eligible){
          await tx.globalPoolAward.create({
            data:{
              globalPoolSettlementId:settlement.globalPoolSettlementId,
              qualificationId:qid,rankLevel:level,rankPoolRate:rate,
              rankPoolAmount:rankPool,eligibleCount:eligible.length,
              payableAmount:each,weakSidePvSnapshot:weakMap.get(qid)!,
              activeSnapshot:true
            }
          });
        }
        distributed=distributed.add(rankPool);
        carryToHigher=new Prisma.Decimal(0);
      }

      return tx.globalPoolSettlement.update({
        where:{globalPoolSettlementId:settlement.globalPoolSettlementId},
        data:{distributedAmount:distributed,undistributedAmount:carryToHigher}
      });
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async accrueWelfare(periodStart:Date,periodEnd:Date,ruleVersionCode='R1.0B'){
    return this.prisma.$transaction(async tx=>{
      const existing=await tx.welfarePoolAccrual.findUnique({
        where:{periodStart_periodEnd_ruleVersionCode:{periodStart,periodEnd,ruleVersionCode}}
      });
      if(existing) return existing;
      const totalGpv=await this.query.totalGpv(tx,periodStart,periodEnd);
      const rate=await this.rules.decimal('pool.welfare.rate','*',periodEnd,ruleVersionCode,tx);
      return tx.welfarePoolAccrual.create({
        data:{periodStart,periodEnd,totalGpv,poolRate:rate,accruedAmount:totalGpv.mul(rate),ruleVersionCode}
      });
    });
  }
}
