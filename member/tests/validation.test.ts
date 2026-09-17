import { expect, it } from 'vitest';
import * as v from '../src/validation';
const q = { id: 'q1', code: 'Q1', rank: 'NEW_RANK', active: true, ballLabel: '球1' };
const product = { id: 'p1', name: 'Test', price: 4800, pv: 2880, available: true };
it('accepts new rank strings, nulls and legitimate zero without coercion', () => {
  expect(v.parseQualifications([q])).toEqual([q]);
  expect(v.parseProducts([{ ...product, price: null, pv: 0 }])[0]).toMatchObject({ price: null, pv: 0 });
});
it.each([undefined, null, {}, [null], [{ ...q, active: 'false' }], [q, q]])('rejects malformed or duplicate qualifications: %s', input => {
  expect(() => v.parseQualifications(input)).toThrow('資料格式異常');
});
it.each(['4800', NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1, undefined])('rejects invalid product prices: %s', price => {
  expect(() => v.parseProducts([{ ...product, price }])).toThrow('資料格式異常');
});
it('requires real booleans and distinct product IDs', () => {
  expect(() => v.parseProducts([{ ...product, available: 'false' }])).toThrow();
  expect(() => v.parseProducts([product, product])).toThrow();
});
it('accepts signed ledger adjustments and rejects unknown award status', () => {
  expect(v.parseLedger({ qualificationId: 'q1', period: '2026-09', entries: [{ id: 'e1', label: 'Clawback', amount: -100, sourceId: 's1', postedAt: 'server timestamp' }] }).entries[0].amount).toBe(-100);
  expect(() => v.parseBonus({ qualificationId: 'q1', period: '2026-09', awards: [{ id: 'a1', name: 'award', status: 'MADE_UP', amount: 0 }] })).toThrow();
});
it('validates nested organizations and count types', () => {
  expect(() => v.parseOrganization({ qualificationId: 'q1', sponsor: null, referrals: [null] })).toThrow();
  const unavailable = {
    qualificationId: 'q1',
    left: { count: 1, volume: null, carry: null },
    right: { count: 0, volume: null, carry: null },
    settlementMetrics: { status: 'UNAVAILABLE', reason: 'SETTLEMENT_METRICS_READ_MODEL_NOT_AVAILABLE' },
    fullTree: { status: 'UNAVAILABLE', reason: 'BINARY_TREE_READ_MODEL_NOT_AVAILABLE' },
  } as const;
  expect(v.parseBinary(unavailable)).toEqual(unavailable);
  expect(() => v.parseBinary({ ...unavailable, left: { ...unavailable.left, count: 1.5 } })).toThrow();
  expect(() => v.parseBinary({ ...unavailable, settlementMetrics: { status: 'AVAILABLE', reason: 1 } })).toThrow();
  expect(() => v.parseBinary({ qualificationId: 'q1', left: { count: 1, volume: null }, right: { count: 0, volume: null } })).toThrow();
});
it('rejects missing period metrics and malformed order arrays', () => {
  expect(() => v.parsePerformance({ qualificationId: 'q1', period: '2026-13' })).toThrow();
  expect(() => v.parseOrders({ qualificationId: 'q1', orders: {} })).toThrow();
  expect(() => v.parsePerson({ name: 'person', memberNo: 'M1', email: false, phone: null })).toThrow();
});
