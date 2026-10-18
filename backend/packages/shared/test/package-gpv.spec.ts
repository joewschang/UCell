import {QUALIFICATION_PACKAGE_GPV_RULE, QUALIFICATION_PACKAGE_POLICY, resolveQualificationPackageGpv, resolveQualificationPackagePolicy} from '../src/package-gpv';

const base = {ruleReference: QUALIFICATION_PACKAGE_GPV_RULE, packageClass: 'QUALIFICATION',
  packageCode: 'LEADER', currency: 'TWD', priceAmount: '72000'};

describe('owner-approved qualification package GPV', () => {
  it.each([
    ['STARTER', '14400', '8640.00'],
    ['ELITE', '43200.0', '25920.00'],
    ['LEADER', '72000.00', '43200.00'],
  ])('%s uses the approved price and 60 percent rate', (packageCode, priceAmount, expected) => {
    expect(resolveQualificationPackageGpv({...base, packageCode, priceAmount}).gpvAmount).toBe(expected);
  });
  it.each(['R1.0B', '', 'future'])('does not reinterpret %s as this new approval', ruleReference => {
    expect(() => resolveQualificationPackageGpv({...base, ruleReference})).toThrow('PACKAGE_GPV_RULE_NOT_APPROVED');
  });
  it.each([
    {packageClass: 'ACTIVE_DURATION'}, {currency: 'USD'}, {packageCode: 'QUARTER'},
    {packageCode: 'toString'}, {packageCode: '__proto__'},
  ])('rejects unapproved scope %j', patch => {
    expect(() => resolveQualificationPackageGpv({...base, ...patch})).toThrow('PACKAGE_GPV_SCOPE_NOT_APPROVED');
  });
  it.each(['72000.001', '7.2e4', '-72000', ' 72000', 'NaN', '', '072000'])('rejects malformed amount %s', priceAmount => {
    expect(() => resolveQualificationPackageGpv({...base, priceAmount})).toThrow('PACKAGE_GPV_INVALID_AMOUNT');
  });
  it.each(['0', '71999.99', '72000.01', '14400'])('does not extend approval to price %s', priceAmount => {
    expect(() => resolveQualificationPackageGpv({...base, priceAmount})).toThrow('PACKAGE_GPV_PRICE_NOT_APPROVED');
  });
  it('is immutable and does not claim consumption, PV/BV amounts, or posting', () => {
    const result = resolveQualificationPackageGpv(base);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).toEqual({status: 'GPV_CANDIDATE_ONLY', ruleReference: QUALIFICATION_PACKAGE_GPV_RULE,
      packageCode: 'LEADER', currency: 'TWD', priceAmount: '72000.00', gpvAmount: '43200.00'});
    expect(base.priceAmount).toBe('72000');
  });
});

describe('qualification GPV-only policy', () => {
  const policyInput = {...base, ruleReference: QUALIFICATION_PACKAGE_POLICY};
  it.each([
    ['2026-10-31T15:59:59.999Z', '2026-10-31T16:00:00.000Z'],
    ['2026-10-31T16:00:00.000Z', '2026-11-30T16:00:00.000Z'],
    ['2026-12-31T16:00:00.000Z', '2027-01-31T16:00:00.000Z'],
  ])('ends Active at Taipei calendar-month end for %s', (paid, end) => {
    const result = resolveQualificationPackagePolicy({...policyInput, paidAt: new Date(paid)});
    expect(result).toMatchObject({gpvAmount: '43200.00', rpvAmount: '0.00', epvAmount: '0.00',
      personalConsumptionEligible: false, activeFrom: paid, activeTo: end, status: 'GPV_CANDIDATE_ONLY'});
    expect(Object.isFrozen(result)).toBe(true);
  });
  it('rejects invalid payment time', () => {
    expect(() => resolveQualificationPackagePolicy({...policyInput, paidAt: new Date(NaN)})).toThrow('PACKAGE_PAYMENT_TIME_INVALID');
  });
  it('requires the new explicit policy approval', () => {
    expect(() => resolveQualificationPackagePolicy({...base, paidAt: new Date()})).toThrow('PACKAGE_POLICY_NOT_APPROVED');
  });
});
