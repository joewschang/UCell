import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

/**
 * Administrative read model for a stored Retail Referral award.  It never calls
 * recognition, settlement or recovery commands and therefore cannot reinterpret
 * historical SKU, Active or attribution evidence from current configuration.
 */
@Injectable()
export class RetailReferralExplainService {
  constructor(private readonly db: PrismaService) {}

  async read(awardId: string) {
    const award = await this.db.bonusAward.findUnique({
      where: { bonusAwardId: awardId },
      include: {
        recipient: { select: { ballNo: true } },
        lifecycleEvents: { orderBy: { occurredAt: 'asc' } },
        recoveryEvents: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!award || award.awardType !== 'RETAIL_REFERRAL') {
      throw new NotFoundException({ code: 'RETAIL_REFERRAL_AWARD_NOT_FOUND' });
    }

    const [snapshot, payable] = await Promise.all([
      award.sourceEventId
        ? this.db.retailReferralOrderLineSnapshot.findUnique({
            where: { orderLineId: award.sourceEventId },
            include: {
              attribution: true,
              orderLine: { select: { skuSnapshot: true, order: { select: { orderNo: true } } } },
            },
          })
        : null,
      this.db.payableEntry.findUnique({
        where: { sourceType_sourceId: { sourceType: 'BONUS_AWARD', sourceId: award.bonusAwardId } },
        include: { payoutLine: { include: { payoutBatch: true } } },
      }),
    ]);

    return {
      awardId: award.bonusAwardId,
      recipientBallNo: award.recipient.ballNo,
      recognition: {
        occurredAt: award.occurredAt.toISOString(),
        attribution: snapshot?.attribution
          ? {
              attributionId: snapshot.attribution.retailReferrerAttributionId,
              ballNo: snapshot.attribution.referrerBallNoSnapshot,
              source: snapshot.attribution.source,
              effectiveFrom: snapshot.attribution.effectiveFrom.toISOString(),
            }
          : null,
        sku: snapshot?.orderLine.skuSnapshot ?? null,
        orderNo: snapshot?.orderLine.order.orderNo.toString() ?? null,
        rate: snapshot?.rate?.toString() ?? null,
        baseType: snapshot?.baseType ?? null,
        productRuleVersion: snapshot?.productRuleVersion ?? null,
      },
      award: {
        theoryAmount: award.theoryAmount.toString(),
        activeAtRecognition: award.activeSnapshot,
        payableAmount: award.payableAmount.toString(),
        finalAmount: award.payableAmount.toString(),
        ruleVersion: award.ruleVersionCode,
        parameterSnapshotHash: award.parameterSnapshotHash,
        lifecycle: award.lifecycleEvents.map((event) => ({
          status: event.status,
          occurredAt: event.occurredAt.toISOString(),
          reasonCode: event.reasonCode,
        })),
      },
      settlement: payable
        ? {
            payableEntryId: payable.payableEntryId,
            status: payable.status,
            availableAt: payable.availableAt.toISOString(),
            payoutStatus: payable.payoutLine?.payoutBatch.status ?? null,
          }
        : null,
      recoveries: award.recoveryEvents.map((event) => ({
        recoveryEventId: event.bonusRecoveryEventId,
        amount: event.recoveryAmount.toString(),
        recovered: event.recoveredAmount.toString(),
        outstanding: event.outstandingAmount.toString(),
        status: event.status,
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  }
}
