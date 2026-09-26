import { Prisma } from '@ucell/database';
import { RetailReferralExplainService } from '../src/modules/order/retail-referral-explain.service';

describe('RetailReferralExplainService', () => {
  it('returns only stored retail evidence and no current rule inputs', async () => {
    const at = new Date('2026-09-26T00:00:00.000Z');
    const db: any = {
      bonusAward: {
        findUnique: jest.fn().mockResolvedValue({
          bonusAwardId: 'award',
          awardType: 'RETAIL_REFERRAL',
          sourceEventId: 'line',
          theoryAmount: new Prisma.Decimal(25),
          payableAmount: new Prisma.Decimal(20),
          activeSnapshot: false,
          ruleVersionCode: 'R1.0B',
          parameterSnapshotHash: 'a'.repeat(64),
          occurredAt: at,
          recipient: { ballNo: 'A000004' },
          lifecycleEvents: [{ status: 'EFFECTIVE', occurredAt: at, reasonCode: null }],
          recoveryEvents: [{
            bonusRecoveryEventId: 'recovery',
            recoveryAmount: new Prisma.Decimal(5),
            recoveredAmount: new Prisma.Decimal(0),
            outstandingAmount: new Prisma.Decimal(5),
            status: 'OPEN',
            occurredAt: at,
          }],
        }),
      },
      retailReferralOrderLineSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          attribution: {
            retailReferrerAttributionId: 'attribution',
            referrerBallNoSnapshot: 'A000004',
            source: 'RETAIL_CHECKOUT_CANDIDATE_REVALIDATED',
            effectiveFrom: at,
          },
          orderLine: { skuSnapshot: 'SKU-HISTORICAL', order: { orderNo: BigInt(42) } },
          rate: new Prisma.Decimal('0.25'),
          baseType: 'NET_PAID_ITEM_AMOUNT',
          productRuleVersion: 'RETAIL-V1',
        }),
      },
      payableEntry: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const result: any = await new RetailReferralExplainService(db).read('award');

    expect(result).toMatchObject({
      recipientBallNo: 'A000004',
      recognition: { sku: 'SKU-HISTORICAL', orderNo: '42', rate: '0.25' },
      award: { theoryAmount: '25', activeAtRecognition: false, payableAmount: '20' },
      settlement: null,
      recoveries: [{ amount: '5', outstanding: '5' }],
    });
    expect(JSON.stringify(result)).not.toContain('legalName');
    expect(db.retailReferralOrderLineSnapshot.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderLineId: 'line' } }),
    );
  });
});
