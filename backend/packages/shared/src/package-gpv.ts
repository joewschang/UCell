/**
 * Product-owner confirmation, 2026-10-18: qualification package GPV = price * 0.6.
 * This resolves a GPV candidate only. It is not a posted recognition, an effective
 * date decision, an eligible-consumption amount, or a return allocation.
 */
export const QUALIFICATION_PACKAGE_GPV_RULE = 'PO_20261018_QUALIFICATION_GPV_60' as const;
export const QUALIFICATION_PACKAGE_POLICY = 'PO_20261019_QUALIFICATION_GPV_ONLY' as const;

const approvedPrices: Readonly<Record<string, string>> = Object.freeze({
  STARTER: '14400.00',
  ELITE: '43200.00',
  LEADER: '72000.00',
});

export type PackageGpvCandidate = Readonly<{
  status: 'GPV_CANDIDATE_ONLY';
  ruleReference: typeof QUALIFICATION_PACKAGE_GPV_RULE;
  packageCode: string;
  currency: 'TWD';
  priceAmount: string;
  gpvAmount: string;
}>;

/** Explicit rule selection prevents legacy R1.0B references adopting this rule. */
export function resolveQualificationPackageGpv(input: {
  ruleReference: string;
  packageClass: string;
  packageCode: string;
  currency: string;
  priceAmount: string;
}): PackageGpvCandidate {
  if (input.ruleReference !== QUALIFICATION_PACKAGE_GPV_RULE) {
    throw new Error('PACKAGE_GPV_RULE_NOT_APPROVED');
  }
  if (input.packageClass !== 'QUALIFICATION' || input.currency !== 'TWD' ||
      !Object.prototype.hasOwnProperty.call(approvedPrices, input.packageCode)) {
    throw new Error('PACKAGE_GPV_SCOPE_NOT_APPROVED');
  }
  // Decimal strings only: do not accept exponent, sign, whitespace or rounding.
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(input.priceAmount)) {
    throw new Error('PACKAGE_GPV_INVALID_AMOUNT');
  }
  const [whole, fraction = ''] = input.priceAmount.split('.');
  const priceAmount = `${whole}.${fraction.padEnd(2, '0')}`;
  if (priceAmount !== approvedPrices[input.packageCode]) {
    throw new Error('PACKAGE_GPV_PRICE_NOT_APPROVED');
  }
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  const gpvCents = cents * 6n / 10n;
  const gpvAmount = `${gpvCents / 100n}.${(gpvCents % 100n).toString().padStart(2, '0')}`;
  return Object.freeze({
    status: 'GPV_CANDIDATE_ONLY', ruleReference: QUALIFICATION_PACKAGE_GPV_RULE,
    packageCode: input.packageCode, currency: 'TWD', priceAmount, gpvAmount,
  });
}

/** Owner clarification: qualification packages grant GPV and current-month Active only. */
export function resolveQualificationPackagePolicy(input: {
  ruleReference: string;
  packageClass: string;
  packageCode: string;
  currency: string;
  priceAmount: string;
  paidAt: Date;
}) {
  if (input.ruleReference !== QUALIFICATION_PACKAGE_POLICY) throw new Error('PACKAGE_POLICY_NOT_APPROVED');
  if (!(input.paidAt instanceof Date) || !Number.isFinite(input.paidAt.getTime())) throw new Error('PACKAGE_PAYMENT_TIME_INVALID');
  const candidate = resolveQualificationPackageGpv({...input, ruleReference: QUALIFICATION_PACKAGE_GPV_RULE});
  const local = new Date(input.paidAt.getTime() + 8 * 60 * 60 * 1000);
  const activeTo = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - 8 * 60 * 60 * 1000);
  return Object.freeze({
    ...candidate,
    ruleReference: QUALIFICATION_PACKAGE_POLICY,
    rpvAmount: '0.00', epvAmount: '0.00', personalConsumptionEligible: false,
    activeFrom: input.paidAt.toISOString(), activeTo: activeTo.toISOString(),
    activeTimezone: 'Asia/Taipei',
  });
}
