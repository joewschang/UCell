import { describe, expect, it } from 'vitest';
import { canOpen } from './permissions';

describe('Admin page access boundaries', () => {
  it('denies unauthenticated and unknown route access', () => {
    expect(canOpen(undefined, '/payouts')).toBe(false);
    expect(canOpen('SUPER_ADMIN', '/unregistered-route')).toBe(false);
  });
  it('denies membership operators access to payout and audit pages', () => {
    expect(canOpen('MEMBERSHIP_OPS', '/payouts')).toBe(false);
    expect(canOpen('MEMBERSHIP_OPS', '/audit')).toBe(false);
  });
  it('denies finance users access to membership workflows', () => {
    expect(canOpen('FINANCE', '/workflows')).toBe(false);
    expect(canOpen('FINANCE', '/applications/new')).toBe(false);
  });
  it('allows compliance audit reads while denying application creation', () => {
    expect(canOpen('COMPLIANCE_AUDIT', '/audit')).toBe(true);
    expect(canOpen('COMPLIANCE_AUDIT', '/applications')).toBe(true);
    expect(canOpen('COMPLIANCE_AUDIT', '/applications/new')).toBe(false);
  });
});
