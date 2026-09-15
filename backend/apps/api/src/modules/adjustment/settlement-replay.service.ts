import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

export type CarryInput = { left: Prisma.Decimal; right: Prisma.Decimal };

export interface BinaryRecipientReplay {
  qualificationId:string;
  originalTheory:Prisma.Decimal;
  recomputedTheory:Prisma.Decimal;
  originalPayable:Prisma.Decimal;
  recomputedPayable:Prisma.Decimal;
  originalCarryOutLeft?:Prisma.Decimal;
  originalCarryOutRight?:Prisma.Decimal;
  recomputedCarryOutLeft?:Prisma.Decimal;
  recomputedCarryOutRight?:Prisma.Decimal;
}

export interface PeriodReplayResult {
  periodStart:Date;
  periodEnd:Date;
  originalK1:Prisma.Decimal;
  recomputedK1:Prisma.Decimal;
  originalK2?:Prisma.Decimal;
  recomputedK2?:Prisma.Decimal;
  binary:BinaryRecipientReplay[];
  matching:Array<{
    qualificationId:string;
    originalPayable:Prisma.Decimal;
    recomputedPayable:Prisma.Decimal;
  }>;
}

@Injectable()
export class SettlementReplayService {
  constructor(private readonly prisma:PrismaService){}

  /**
   * Economic-period GPV:
   * select ORIGINAL GPV events whose occurred_at belongs to the historical period,
   * then add every reversal linked to those originals regardless of the later reversal timestamp.
   * This prevents a refund posted today from being missed when replaying an older week.
   */
  async subtreeEconomicGpv(
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
          AND effective_from < ${end}
          AND (effective_to IS NULL OR effective_to > ${start})
      ),
      subtree AS (
        SELECT qualification_id FROM first_child
        UNION ALL
        SELECT bp.child_qualification_id
        FROM organization.binary_placement bp
        JOIN subtree s ON bp.parent_qualification_id=s.qualification_id
        WHERE bp.effective_from < ${end}
          AND (bp.effective_to IS NULL OR bp.effective_to > ${start})
      ),
      originals AS (
        SELECT p.event_id,p.amount
        FROM ledger.pv_ledger p
        JOIN subtree s ON s.qualification_id=p.qualification_id
        WHERE p.pv_type='GPV'::ledger."PvType"
          AND p.event_type='GPV_CREATED'
          AND p.occurred_at >= ${start}
          AND p.occurred_at < ${end}
      ),
      reversals AS (
        SELECT r.reversal_of_event_id AS event_id, SUM(r.amount) AS amount
        FROM ledger.pv_ledger r
        WHERE r.pv_type='GPV'::ledger."PvType"
          AND r.event_type='GPV_REVERSAL'
          AND r.reversal_of_event_id IN (SELECT event_id FROM originals)
        GROUP BY r.reversal_of_event_id
      )
      SELECT COALESCE(SUM(o.amount + COALESCE(r.amount,0)),0)::text AS amount
      FROM originals o
      LEFT JOIN reversals r ON r.event_id=o.event_id
    `;
    return new Prisma.Decimal(rows[0]?.amount ?? '0');
  }

  async replayPeriod(
    tx:Prisma.TransactionClient,
    input:{
      periodStart:Date;periodEnd:Date;ruleVersionCode:string;
      carryOverrides:Map<string,CarryInput>;
    }
  ):Promise<PeriodReplayResult>{
    const binaryBatch=await tx.settlementBatch.findFirst({
      where:{
        settlementType:'BINARY_K1',
        periodStart:input.periodStart,periodEnd:input.periodEnd,
        ruleVersionCode:input.ruleVersionCode,status:'FINALIZED'
      }
    });
    if(!binaryBatch) throw new Error(`Binary settlement missing for ${input.periodEnd.toISOString()}`);

    const binaryAwards=await tx.bonusAward.findMany({
      where:{settlementBatchId:binaryBatch.settlementBatchId,awardType:'BINARY'}
    });

    const originalByQ=new Map(binaryAwards.map(a=>[a.recipientQualificationId,a]));
    const theoryOverride=new Map<string,Prisma.Decimal>();
    const carryResult=new Map<string,{
      originalLeft:Prisma.Decimal;originalRight:Prisma.Decimal;
      newLeft:Prisma.Decimal;newRight:Prisma.Decimal;
    }>();

    const pairRateRow=await tx.runtimeRuleParameter.findFirst({
      where:{
        ruleVersionCode:input.ruleVersionCode,parameterCode:'binary.pair.rate',scopeKey:'*',
        effectiveFrom:{lte:input.periodEnd},
        OR:[{effectiveTo:null},{effectiveTo:{gt:input.periodEnd}}]
      },
      orderBy:{effectiveFrom:'desc'}
    });
    if(!pairRateRow) throw new Error('binary.pair.rate missing');
    const pairRate=new Prisma.Decimal(String(pairRateRow.valueJson));

    for(const [qid,carryIn] of input.carryOverrides){
      const carry=await tx.binaryCarry.findFirst({
        where:{qualificationId:qid,periodEnd:input.periodEnd,ruleVersionCode:input.ruleVersionCode}
      });
      if(!carry) continue;

      const leftPeriod=await this.subtreeEconomicGpv(tx,qid,'LEFT',input.periodStart,input.periodEnd);
      const rightPeriod=await this.subtreeEconomicGpv(tx,qid,'RIGHT',input.periodStart,input.periodEnd);
      const leftAvailable=carryIn.left.add(leftPeriod);
      const rightAvailable=carryIn.right.add(rightPeriod);
      const paired=Prisma.Decimal.min(
        Prisma.Decimal.min(leftAvailable,rightAvailable),
        carry.weeklyCapSnapshot
      );
      theoryOverride.set(qid,paired.mul(pairRate));
      carryResult.set(qid,{
        originalLeft:carry.leftCarryOut,originalRight:carry.rightCarryOut,
        newLeft:leftAvailable.sub(paired),newRight:rightAvailable.sub(paired)
      });
    }

    let totalTheory=new Prisma.Decimal(0);
    for(const a of binaryAwards){
      totalTheory=totalTheory.add(theoryOverride.get(a.recipientQualificationId) ?? a.theoryAmount);
    }
    const k1=totalTheory.gt(0)
      ? Prisma.Decimal.min(new Prisma.Decimal(1),binaryBatch.poolAvailable.div(totalTheory))
      : new Prisma.Decimal(1);

    const binary:BinaryRecipientReplay[]=binaryAwards.map(a=>{
      const recomputedTheory=theoryOverride.get(a.recipientQualificationId) ?? a.theoryAmount;
      const cr=carryResult.get(a.recipientQualificationId);
      return {
        qualificationId:a.recipientQualificationId,
        originalTheory:a.theoryAmount,recomputedTheory,
        originalPayable:a.payableAmount,recomputedPayable:recomputedTheory.mul(k1),
        originalCarryOutLeft:cr?.originalLeft,originalCarryOutRight:cr?.originalRight,
        recomputedCarryOutLeft:cr?.newLeft,recomputedCarryOutRight:cr?.newRight
      };
    });

    const matchingBatch=await tx.settlementBatch.findFirst({
      where:{
        settlementType:'MATCHING_K2',
        periodStart:input.periodStart,periodEnd:input.periodEnd,
        ruleVersionCode:input.ruleVersionCode,status:'FINALIZED'
      }
    });
    if(!matchingBatch){
      return {
        periodStart:input.periodStart,periodEnd:input.periodEnd,
        originalK1:binaryBatch.kFactor,recomputedK1:k1,binary,matching:[]
      };
    }

    const matchingAwards=await tx.bonusAward.findMany({
      where:{settlementBatchId:matchingBatch.settlementBatchId,awardType:'MATCHING'}
    });
    const recomputedBinaryPaidByAwardId=new Map<string,Prisma.Decimal>();
    for(const a of binaryAwards){
      const r=binary.find(x=>x.qualificationId===a.recipientQualificationId)!;
      recomputedBinaryPaidByAwardId.set(a.bonusAwardId,r.recomputedPayable);
    }

    const matchingTheory=new Map<string,Prisma.Decimal>();
    let totalMatchingTheory=new Prisma.Decimal(0);
    for(const a of matchingAwards){
      const detail=a.calculationDetail as any;
      const rate=new Prisma.Decimal(String(detail?.rate ?? '0'));
      const sourcePaid=a.sourceAwardId
        ? (recomputedBinaryPaidByAwardId.get(a.sourceAwardId) ?? new Prisma.Decimal(String(detail?.sourceBinaryPaid ?? '0')))
        : new Prisma.Decimal(String(detail?.sourceBinaryPaid ?? '0'));
      const theory=sourcePaid.mul(rate);
      matchingTheory.set(a.bonusAwardId,theory);
      totalMatchingTheory=totalMatchingTheory.add(theory);
    }
    const k2=totalMatchingTheory.gt(0)
      ? Prisma.Decimal.min(new Prisma.Decimal(1),matchingBatch.poolAvailable.div(totalMatchingTheory))
      : new Prisma.Decimal(1);

    return {
      periodStart:input.periodStart,periodEnd:input.periodEnd,
      originalK1:binaryBatch.kFactor,recomputedK1:k1,
      originalK2:matchingBatch.kFactor,recomputedK2:k2,
      binary,
      matching:matchingAwards.map(a=>({
        qualificationId:a.recipientQualificationId,
        originalPayable:a.payableAmount,
        recomputedPayable:(matchingTheory.get(a.bonusAwardId) ?? a.theoryAmount).mul(k2)
      }))
    };
  }
}
