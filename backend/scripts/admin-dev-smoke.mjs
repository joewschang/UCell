import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const base = 'http://127.0.0.1:3001/api/v1';
const results = [];
async function check(method, route, expected = 200) {
  const response = await fetch(base + route, { method,
    ...(!['GET', 'HEAD'].includes(method) ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}) });
  const body = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(body)}`);
  if (expected === 200) assert.ok(Object.hasOwn(body, 'data'), `${route}: envelope missing`);
  results.push({ method, route, status: response.status, result: 'PASS' });
  return body;
}
try {
  const countsBefore = await Promise.all([prisma.person.count(), prisma.order.count(), prisma.bonusAward.count(), prisma.pvLedger.count(), prisma.payableEntry.count()]);
  const summary = await check('GET', '/admin/dashboard/summary');
  assert.equal(summary.data.persons, countsBefore[0], 'Dashboard must match real PostgreSQL');
  for (const route of ['/health', '/admin/persons', '/admin/products', '/admin/qualifications', '/admin/orders',
    '/admin/membership-applications', '/admin/subscriptions/plans', '/admin/observability/compensation/summary',
    '/admin/observability/settlements', '/admin/observability/pools', '/admin/operations/returns',
    '/admin/operations/workflows', '/admin/operations/recoveries', '/admin/operations/payout-batches',
    '/admin/ops-ready/audit-events', '/admin/ops-ready/reports/operations?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z', '/admin/ops-ready/integrity-alerts']) {
    await check('GET', route);
  }
  await check('GET', '/admin/ops-ready/reports/operations', 400);
  await check('GET', '/admin/ops-ready/reports/operations?from=invalid&to=invalid', 400);
  await check('GET', '/admin/ops-ready/reports/operations?from=2026-10-01&to=2026-09-01', 400);
  for (const [method, route] of [['POST', '/admin/persons'], ['POST', '/admin/orders'],
    ['POST', '/admin/operations/payout-batches/00000000-0000-4000-8000-000000000000/mark-paid']]) {
    await check(method, route, 405);
  }
  const countsAfter = await Promise.all([prisma.person.count(), prisma.order.count(), prisma.bonusAward.count(), prisma.pvLedger.count(), prisma.payableEntry.count()]);
  assert.deepEqual(countsAfter, countsBefore, 'Read-only smoke must not create persons, orders or monetary facts');
  const evidence = { startedAt: new Date().toISOString(), mode: 'LOCAL ADMIN DEV READ ONLY', results,
    databaseCountMatch: 'PASS', writeRejection: 'PASS', unchangedDomainCounts: 'PASS',
    note: 'Real DEV DB; HTTP audit events append normally. No formal monetary result generated.' };
  fs.mkdirSync('../governance/admin-local-dev', { recursive: true });
  fs.writeFileSync('../governance/admin-local-dev/smoke-results.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(`ADMIN_DEV_SMOKE_PASS: ${results.length} HTTP checks; database match; writes rejected`);
} finally { await prisma.$disconnect(); }
