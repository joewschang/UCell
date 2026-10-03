import { describe, expect, it } from 'vitest';
import { lineExchangeFailureMessage, sponsorCandidateFromSearch } from './liff';
describe('LINE login states',()=>{
 it('uses actionable server-safe messages for account states',()=>{
  expect(lineExchangeFailureMessage(401,'LINE_ACCOUNT_UNBOUND')).toContain('公司核驗');
  expect(lineExchangeFailureMessage(401,'MEMBER_SECURITY_LOCKED')).toContain('安全鎖定');
  expect(lineExchangeFailureMessage(503,'LINE_NOT_CONFIGURED')).toContain('尚未設定');
  expect(lineExchangeFailureMessage(401,'unknown')).not.toContain('unknown');
 });
 it('keeps only Ball-number referral candidates through LINE navigation',()=>{
  expect(sponsorCandidateFromSearch('?ref=A001286')).toBe('A001286');
  expect(sponsorCandidateFromSearch('?ref=AX000001')).toBe('AX000001');
  expect(sponsorCandidateFromSearch('?ref=MEMBER-0001')).toBeUndefined();
  expect(sponsorCandidateFromSearch('?ref=550e8400-e29b-41d4-a716-446655440000')).toBeUndefined();
 });
});
