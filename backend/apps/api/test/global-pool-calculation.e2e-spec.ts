import { Prisma } from '@ucell/database';
import { calculateGlobalPool } from '../src/modules/global-pool/global-pool-calculation';

describe('Global Pool v3 pure calculation', () => {
  it('does not add an empty rank slice to a later recipient right', () => {
    const result = calculateGlobalPool(new Prisma.Decimal(1000), new Prisma.Decimal(50), [
      { level: 'NEW_STAR', rate: new Prisma.Decimal('0.015'), eligibleQualificationIds: [] },
      { level: 'EXCELLENCE', rate: new Prisma.Decimal('0.010'), eligibleQualificationIds: ['higher-rank-recipient'] },
      { level: 'GLORY', rate: new Prisma.Decimal('0.005'), eligibleQualificationIds: [] },
      { level: 'DIAMOND', rate: new Prisma.Decimal('0.005'), eligibleQualificationIds: [] },
      { level: 'CROWN', rate: new Prisma.Decimal('0.015'), eligibleQualificationIds: [] },
    ]);

    expect(result.slices[1].amountPerRecipient?.toString()).toBe('10');
    expect(result.distributedAmount.toString()).toBe('10');
    expect(result.undistributedAmount.toString()).toBe('40');
    expect(result.distributedAmount.add(result.undistributedAmount).toString()).toBe('50');
  });

  it('accounts an unconfigured pool residual as undistributed', () => {
    const result = calculateGlobalPool(new Prisma.Decimal(1000), new Prisma.Decimal(50), [
      { level: 'NEW_STAR', rate: new Prisma.Decimal('0.015'), eligibleQualificationIds: ['recipient'] },
    ]);

    expect(result.distributedAmount.toString()).toBe('15');
    expect(result.undistributedAmount.toString()).toBe('35');
    expect(result.distributedAmount.add(result.undistributedAmount).toString()).toBe('50');
  });

  it('fails closed when configured slices exceed the available pool', () => {
    expect(() => calculateGlobalPool(new Prisma.Decimal(1000), new Prisma.Decimal(10), [
      { level: 'NEW_STAR', rate: new Prisma.Decimal('0.015'), eligibleQualificationIds: ['recipient'] },
    ])).toThrow('Global rank slices exceed the available Global pool');
  });
});
