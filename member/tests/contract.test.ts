import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyBundle } from '../contracts/verify';
import { sample } from '../contracts/sample';

it('validates all ten responses from the supplied bundle or synthetic baseline', () => {
  const file = process.env.MEMBER_CONTRACT_FILE;
  let bundle: unknown = sample;
  if (file) {
    try { bundle = JSON.parse(readFileSync(file, 'utf8')); }
    catch { throw Error('Cannot read a valid contract JSON file; file contents are not logged'); }
  }
  const results = verifyBundle(bundle);
  expect(results).toHaveLength(10);
  expect(results.filter(r => !r.passed)).toEqual([]);
});
it('rejects missing endpoints rather than treating an incomplete bundle as success', () => {
  const bundle = structuredClone(sample); delete bundle.responses.orders;
  expect(verifyBundle(bundle).filter(r => !r.passed)).toEqual([{ endpoint: '/member/orders', passed: false }]);
});
it('detects foreign qualifications and mismatched months', () => {
  const bundle = structuredClone(sample);
  (bundle.responses.performance.data as { period: string }).period = '2026-08';
  (bundle.responses.orders.data as { qualificationId: string }).qualificationId = 'foreign';
  expect(verifyBundle(bundle).filter(r => !r.passed).map(r => r.endpoint)).toEqual(['/member/performance', '/member/orders']);
});
it('does not leak invalid response contents in diagnostics', () => {
  const bundle = structuredClone(sample);
  bundle.responses.person.data = { secret: 'private-test-value' } as never;
  const results = verifyBundle(bundle);
  expect(results.some(r => !r.passed)).toBe(true);
  expect(JSON.stringify(results)).not.toContain('private-test-value');
});
it('rejects an unowned bundle qualification even with otherwise valid responses', () => {
  const bundle = structuredClone(sample); bundle.qualificationId = 'foreign';
  expect(verifyBundle(bundle).filter(r => !r.passed)).toHaveLength(8);
});
