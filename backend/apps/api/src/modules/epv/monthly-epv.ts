import { Prisma } from '@ucell/database';
import { pending } from '../rules/parameter-snapshot';

/** SA-20260915-02. Decimal-only domain calculation; no database writes. */
export function monthlyEpv(consumption:Prisma.Decimal, threshold:Prisma.Decimal, rate:Prisma.Decimal) {
  if(consumption.lt(0)||threshold.lt(0)||rate.lt(0)||rate.gt(1)) pending('INVALID_EPV_INPUT','Monthly EPV inputs are outside their valid range');
  return Prisma.Decimal.max(new Prisma.Decimal(0),consumption.sub(threshold)).mul(rate);
}

export function monthlyReturnDelta(before:Prisma.Decimal, returned:Prisma.Decimal, threshold:Prisma.Decimal, rate:Prisma.Decimal) {
  if(returned.lt(0)||returned.gt(before)) pending('INVALID_EPV_RETURN','Return exceeds monthly eligible consumption');
  const after=before.sub(returned);
  const original=monthlyEpv(before,threshold,rate),recomputed=monthlyEpv(after,threshold,rate);
  return {before,after,original,recomputed,delta:recomputed.sub(original)};
}
