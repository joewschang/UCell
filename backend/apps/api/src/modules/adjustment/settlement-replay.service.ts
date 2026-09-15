import { pending, verifySnapshot, snapshotDecimal } from '../rules/parameter-snapshot';
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
      WITH RECURSIVE originals AS (
        SELECT event_id,qualification_id,amount,occurred_at
        FROM ledger.pv_ledger
        WHERE pv_type='GPV'::ledger."PvType" AND event_type='GPV_CREATED'
          AND occurred_at>=${start} AND occurred_at<${end}
      ),
      subtree AS (
        SELECT o.event_id,o.occurred_at,bp.child_qualification_id AS qualification_id
        FROM originals o JOIN organization.binary_placement bp
          ON bp.parent_qualification_id=${rootQualificationId}::uuid
          AND bp.side=${side}::organization."SideCode"
          AND bp.effective_from<=o.occurred_at
          AND (bp.effective_to IS NULL OR bp.effective_to>o.occurred_at)
        UNION ALL
        SELECT s.event_id,s.occurred_at,bp.child_qualification_id
        FROM subtree s JOIN organization.binary_placement bp ON bp.parent_qualification_id=s.qualification_id
          AND bp.effective_from<=s.occurred_at
          AND (bp.effective_to IS NULL OR bp.effective_to>s.occurred_at)
      ),
      members AS (
        SELECT DISTINCT o.event_id FROM originals o JOIN subtree s
          ON s.event_id=o.event_id AND s.qualification_id=o.qualification_id
      ),
      reversals AS (
        SELECT reversal_of_event_id AS event_id,SUM(amount) AS amount
        FROM ledger.pv_ledger WHERE pv_type='GPV'::ledger."PvType" AND event_type='GPV_REVERSAL'
        GROUP BY reversal_of_event_id
      )
      SELECT COALESCE(SUM(o.amount+COALESCE(r.amount,0)),0)::text AS amount
      FROM originals o JOIN members m USING(event_id) LEFT JOIN reversals r USING(event_id)
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

    const historicalParameters=verifySnapshot(binaryBatch.parameterSnapshot);
    if(historicalParameters.ruleVersionCode!==input.ruleVersionCode) pending('RULE_VERSION_MISMATCH','Historical snapshot belongs to another rule version');
    const pairRate=snapshotDecimal(historicalParameters,'binary.pair.rate');
    const economicTotal=await tx.$queryRaw<Array<{amount:string}>>`
      WITH originals AS (SELECT event_id,amount FROM ledger.pv_ledger WHERE pv_type='GPV'::ledger."PvType" AND event_type='GPV_CREATED' AND occurred_at>=${input.periodStart} AND occurred_at<${input.periodEnd}),
      reversals AS (SELECT reversal_of_event_id AS event_id,SUM(amount) AS amount FROM ledger.pv_ledger WHERE event_type='GPV_REVERSAL' AND pv_type='GPV'::ledger."PvType" GROUP BY reversal_of_event_id)
      SELECT COALESCE(SUM(o.amount+COALESCE(r.amount,0)),0)::text AS amount FROM originals o LEFT JOIN reversals r USING(event_id)`;
    const totalGpv=new Prisma.Decimal(economicTotal[0]?.amount??'0');
    if(totalGpv.lt(0)) pending('NEGATIVE_ECONOMIC_GPV','Linked reversals exceed original volume');
    const binaryPool=totalGpv.mul(snapshotDecimal(historicalParameters,'pool.binary.rate'));

    for(const [qid,carryIn] of input.carryOverrides){
      const carry=await tx.binaryCarry.findFirst({
        where:{qualificationId:qid,periodEnd:input.periodEnd,ruleVersionCode:input.ruleVersionCode}
      });
      if(!carry) pending('HISTORICAL_CARRY_MISSING','Affected qualification missing historical carry');

      const leftPeriod=await this.subtreeEconomicGpv(tx,qid,'LEFT',input.periodStart,input.periodEnd);
      const rightPeriod=await this.subtreeEconomicGpv(tx,qid,'RIGHT',input.periodStart,input.periodEnd);
      const leftAvailable=carryIn.left.add(leftPeriod);
      const rightAvailable=carryIn.right.add(rightPeriod);
      if(leftAvailable.lt(0)||rightAvailable.lt(0)) pending('NEGATIVE_ECONOMIC_GPV','Linked reversals exceed effective subtree volume');
      const paired=Prisma.Decimal.min(
        Prisma.Decimal.min(leftAvailable,rightAvailable),
        carry.weeklyCapSnapshot
      );
      theoryOverride.set(qid,originalByQ.get(qid)?.activeSnapshot?paired.mul(pairRate):new Prisma.Decimal(0));
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
      ? Prisma.Decimal.min(new Prisma.Decimal(1),binaryPool.div(totalTheory))
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

    for(const [qid,cr] of carryResult) {
      if(binary.some(r=>r.qualificationId===qid)) continue;
      binary.push({qualificationId:qid,originalTheory:new Prisma.Decimal(0),recomputedTheory:new Prisma.Decimal(0),originalPayable:new Prisma.Decimal(0),recomputedPayable:new Prisma.Decimal(0),originalCarryOutLeft:cr.originalLeft,originalCarryOutRight:cr.originalRight,recomputedCarryOutLeft:cr.newLeft,recomputedCarryOutRight:cr.newRight});
    }
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

    const matchingParameters=verifySnapshot(matchingBatch.parameterSnapshot);
    const matchingPool=totalGpv.mul(snapshotDecimal(matchingParameters,'pool.matching.rate'));
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
      if(detail?.rate==null || !a.sourceAwardId || !recomputedBinaryPaidByAwardId.has(a.sourceAwardId)) pending('MATCHING_SOURCE_SNAPSHOT_MISSING','Original rate and exact source Binary award required');
      const rate=new Prisma.Decimal(String(detail.rate));
      const sourcePaid=a.sourceAwardId
        ? (recomputedBinaryPaidByAwardId.get(a.sourceAwardId) ?? new Prisma.Decimal(String(detail?.sourceBinaryPaid ?? '0')))
        : new Prisma.Decimal(String(detail?.sourceBinaryPaid ?? '0'));
      const theory=sourcePaid.mul(rate);
      matchingTheory.set(a.bonusAwardId,theory);
      totalMatchingTheory=totalMatchingTheory.add(theory);
    }
    const k2=totalMatchingTheory.gt(0)
      ? Prisma.Decimal.min(new Prisma.Decimal(1),matchingPool.div(totalMatchingTheory))
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
