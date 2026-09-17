import { createHash } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { GlobalRankCode, Prisma } from '@ucell/database';

export interface GlobalPoolAwardWrite {
  qualificationId: string;
  rankLevel: GlobalRankCode;
  rankPoolRate: Prisma.Decimal;
  rankPoolAmount: Prisma.Decimal;
  eligibleCount: number;
  payableAmount: Prisma.Decimal;
  weakSidePvSnapshot: Prisma.Decimal;
}

export interface GlobalPoolSettlementWrite {
  settlementId: string;
  periodStart: Date;
  periodEnd: Date;
  totalGpv: Prisma.Decimal;
  poolRate: Prisma.Decimal;
  poolAvailable: Prisma.Decimal;
  distributedAmount: Prisma.Decimal;
  undistributedAmount: Prisma.Decimal;
  ruleVersionCode: string;
  parameterSnapshot: Prisma.InputJsonValue;
  awards: GlobalPoolAwardWrite[];
}

@Injectable()
export class GlobalPoolPersistence {
  private reservoirKey(settlementId: string) {
    return `reservoir:A:global-undistributed:${settlementId}`;
  }

  private reservoirHash(input: {
    settlementId: string;
    periodStart: Date;
    periodEnd: Date;
    amount: Prisma.Decimal;
    ruleVersionCode: string;
  }) {
    return createHash('sha256').update(JSON.stringify({
      reservoirCode: 'A',
      effectType: 'GLOBAL_UNDISTRIBUTED',
      sourceGlobalSettlementId: input.settlementId,
      sourcePeriodStart: input.periodStart.toISOString(),
      sourcePeriodEnd: input.periodEnd.toISOString(),
      amount: input.amount.toFixed(4),
      ruleVersionCode: input.ruleVersionCode,
      idempotencyKey: this.reservoirKey(input.settlementId),
    })).digest('hex');
  }

  async persist(tx: Prisma.TransactionClient, input: GlobalPoolSettlementWrite) {
    const settlement = await tx.globalPoolSettlement.create({
      data: {
        globalPoolSettlementId: input.settlementId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalGpv: input.totalGpv,
        poolRate: input.poolRate,
        poolAvailable: input.poolAvailable,
        distributedAmount: input.distributedAmount,
        undistributedAmount: input.undistributedAmount,
        ruleVersionCode: input.ruleVersionCode,
        parameterSnapshot: input.parameterSnapshot,
      },
    });

    for (const award of input.awards) {
      await tx.globalPoolAward.create({
        data: {
          globalPoolSettlementId: input.settlementId,
          ...award,
          activeSnapshot: true,
        },
      });
    }

    await tx.reservoirLedgerEffect.create({
      data: {
        reservoirCode: 'A',
        effectType: 'GLOBAL_UNDISTRIBUTED',
        sourceGlobalSettlementId: input.settlementId,
        sourcePeriodStart: input.periodStart,
        sourcePeriodEnd: input.periodEnd,
        amount: input.undistributedAmount,
        ruleVersionCode: input.ruleVersionCode,
        idempotencyKey: this.reservoirKey(input.settlementId),
        evidenceHash: this.reservoirHash({
          settlementId: input.settlementId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          amount: input.undistributedAmount,
          ruleVersionCode: input.ruleVersionCode,
        }),
      },
    });
    return settlement;
  }

  async verifiedExisting(tx: Prisma.TransactionClient, periodStart: Date, periodEnd: Date, ruleVersionCode: string) {
    const settlement = await tx.globalPoolSettlement.findUnique({
      where: { periodStart_periodEnd_ruleVersionCode: { periodStart, periodEnd, ruleVersionCode } },
    });
    if (!settlement) return null;

    const effect = await tx.reservoirLedgerEffect.findUnique({
      where: {
        reservoirCode_effectType_sourceGlobalSettlementId: {
          reservoirCode: 'A',
          effectType: 'GLOBAL_UNDISTRIBUTED',
          sourceGlobalSettlementId: settlement.globalPoolSettlementId,
        },
      },
    });
    const expectedHash = this.reservoirHash({
      settlementId: settlement.globalPoolSettlementId,
      periodStart: settlement.periodStart,
      periodEnd: settlement.periodEnd,
      amount: settlement.undistributedAmount,
      ruleVersionCode: settlement.ruleVersionCode,
    });
    if (!effect || effect.sourcePeriodStart.getTime() !== settlement.periodStart.getTime()
      || effect.sourcePeriodEnd.getTime() !== settlement.periodEnd.getTime()
      || !effect.amount.equals(settlement.undistributedAmount)
      || effect.ruleVersionCode !== settlement.ruleVersionCode
      || effect.idempotencyKey !== this.reservoirKey(settlement.globalPoolSettlementId)
      || effect.evidenceHash !== expectedHash) {
      throw new ConflictException({ code: 'RESERVOIR_A_EVIDENCE_INVALID' });
    }
    return settlement;
  }
}
