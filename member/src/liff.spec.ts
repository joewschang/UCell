import { describe, expect, it } from 'vitest';
import { lineExchangeFailureMessage } from './liff';
describe('LINE login states',()=>{
 it('uses actionable server-safe messages for account states',()=>{
  expect(lineExchangeFailureMessage(401,'LINE_ACCOUNT_UNBOUND')).toContain('公司核驗');
  expect(lineExchangeFailureMessage(401,'MEMBER_SECURITY_LOCKED')).toContain('安全鎖定');
  expect(lineExchangeFailureMessage(503,'LINE_NOT_CONFIGURED')).toContain('尚未設定');
  expect(lineExchangeFailureMessage(401,'unknown')).not.toContain('unknown');
 });
});