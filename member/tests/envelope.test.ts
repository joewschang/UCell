import { expect, it } from 'vitest';
import { unwrapMemberEnvelope } from '../src/memberApi';
const meta = { request_id: 'test-request', timestamp: '2026-09-15T00:00:00.000Z', api_version: 'v1' };
it('extracts objects and arrays without changing their contents', () => {
  for (const data of [{ amount: null, adjustment: -12, zero: 0 }, [], [{ id: 'q1' }], null])
    expect(unwrapMemberEnvelope({ data, meta })).toBe(data);
});
it('rejects bare DTOs and missing payloads', () => {
  for (const value of [null, [], { id: 'q1' }, { meta }, { data: [] }])
    expect(() => unwrapMemberEnvelope(value)).toThrow('API 回應格式異常');
});
it('rejects invalid metadata and unsupported API versions', () => {
  for (const invalid of [null, [], { ...meta, api_version: 'v2' }, { ...meta, request_id: '' }, { ...meta, timestamp: 'bad' }])
    expect(() => unwrapMemberEnvelope({ data: [], meta: invalid })).toThrow('API 回應格式異常');
});
it('does not recursively unwrap or expose server diagnostic text', () => {
  const data = { data: 0, meta: { note: 'domain-owned' } };
  expect(unwrapMemberEnvelope({ data, meta })).toBe(data);
  expect(() => unwrapMemberEnvelope({ error: 'private server diagnostic' })).toThrow('API 回應格式異常');
});
