import { GlobalRankCode, Prisma } from '@ucell/database';

export interface GlobalRankSliceInput {
  level: GlobalRankCode;
  rate: Prisma.Decimal;
  eligibleQualificationIds: string[];
}

export interface GlobalRankSliceResult extends GlobalRankSliceInput {
  amount: Prisma.Decimal;
  amountPerRecipient: Prisma.Decimal | null;
}

export interface GlobalPoolCalculationResult {
  slices: GlobalRankSliceResult[];
  distributedAmount: Prisma.Decimal;
  undistributedAmount: Prisma.Decimal;
}

/**
 * Calculates fixed Global rank slices without transferring an empty slice to
 * another rank. Persistence of undistributed funds to Reservoir A belongs to
 * the settlement persistence boundary once its approved schema is available.
 */
export function calculateGlobalPool(
  totalGpv: Prisma.Decimal,
  poolAvailable: Prisma.Decimal,
  inputs: GlobalRankSliceInput[],
): GlobalPoolCalculationResult {
  // Truncate each equal right at the persisted monetary scale. Rounding up
  // could over-distribute a slice; all remainder belongs to Reservoir A.
  const currency = (value: Prisma.Decimal) => value.toDecimalPlaces(4, Prisma.Decimal.ROUND_DOWN);
  let distributedAmount = new Prisma.Decimal(0);
  let undistributedAmount = new Prisma.Decimal(0);

  const slices = inputs.map((input): GlobalRankSliceResult => {
    const amount = totalGpv.mul(input.rate);
    if (input.eligibleQualificationIds.length === 0) {
      undistributedAmount = undistributedAmount.add(amount);
      return { ...input, amount, amountPerRecipient: null };
    }

    // Awards are persisted as Decimal(18,4).  Account the amount that will
    // actually be persisted and retain every division residue in Reservoir A.
    const amountPerRecipient = currency(amount.div(input.eligibleQualificationIds.length));
    const persistedDistribution = amountPerRecipient.mul(input.eligibleQualificationIds.length);
    distributedAmount = distributedAmount.add(persistedDistribution);
    undistributedAmount = undistributedAmount.add(amount.sub(persistedDistribution));
    return {
      ...input,
      amount,
      amountPerRecipient,
    };
  });

  const assignedAmount = distributedAmount.add(undistributedAmount);
  if (assignedAmount.gt(poolAvailable)) {
    throw new Error('Global rank slices exceed the available Global pool');
  }

  // Any unconfigured/residual pool balance is also undistributed. This keeps
  // poolAvailable = distributedAmount + undistributedAmount by construction.
  undistributedAmount = undistributedAmount.add(poolAvailable.sub(assignedAmount));

  return { slices, distributedAmount, undistributedAmount };
}
