import {QUALIFICATION_PACKAGE_GPV_RULE, resolveQualificationPackageGpv} from '../src/package-gpv';

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
