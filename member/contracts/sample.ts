const q = { id: 'fixture-q1', code: 'FIXTURE-Q1', rank: 'ELITE', active: true, ballLabel: '測試球 1' };
const month = { qualificationId: q.id, period: '2026-09' };
const bodies = {
  qualifications: [q],
  person: { name: '測試會員', memberNo: 'FIXTURE-M1', email: null, phone: null },
  dashboard: { memberName: '測試會員', memberNo: 'FIXTURE-M1', qualification: q, monthlyRepurchaseStatus: 'PENDING', pv: null, rpv: null, epv: null, bonusAmount: null, bonusStatus: 'PENDING' },
  organization: { qualificationId: q.id, sponsor: null, referrals: [] },
  binary: { qualificationId: q.id, left: { count: 0, volume: null }, right: { count: 0, volume: null } },
  performance: { ...month, pv: null, rpv: null, epv: null, left: null, right: null, asOf: null },
  bonuses: { ...month, awards: [{ id: 'fixture-award', name: '測試獎金', status: 'PENDING', amount: null }] },
  ledger: { ...month, entries: [{ id: 'fixture-adjustment', label: '測試調整', amount: -1, postedAt: '2026-09-15T00:00:00Z', sourceId: 'fixture-source' }] },
  products: [{ id: 'fixture-product', name: '測試商品', price: 0, pv: null, available: false }],
  orders: { qualificationId: q.id, orders: [] },
};
/** Synthetic display fixtures only; not approved products, awards or business rules. */
export const sample = {
  qualificationId: q.id, period: month.period,
  responses: Object.fromEntries(Object.entries(bodies).map(([key, data]) => [key, {
    data, meta: { request_id: `fixture-${key}`, timestamp: '2026-09-15T00:00:00Z', api_version: 'v1' },
  }])),
};
