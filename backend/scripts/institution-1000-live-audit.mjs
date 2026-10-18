// Independent read-only audit of completed months before the isolated runner
// removes its database. Does not write to the database or drive recognition.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const logs = process.argv[2];
const sourceFile = process.argv[3] ?? 'institution-1000-baseline-evidence-20261011.json';
const outputFile = process.argv[4] ?? 'institution-1000-live-audit-20261011.json';
const base = new URL(process.env.DATABASE_URL);
assert.equal(base.hostname, '127.0.0.1'); assert.equal(base.port, '55439');
base.pathname = '/postgres';
const admin = new PrismaClient({ datasources: { db: { url: base.href } } });
let db;
const evidence = { scope: 'READ_ONLY_DATABASE_AGGREGATES', status: 'RUNNING', months: [] };
const output = path.join(logs, outputFile);
const save = () => fs.writeFileSync(output, JSON.stringify(evidence, null, 2));
try {
  const candidates = await admin.$queryRawUnsafe("SELECT datname FROM pg_database WHERE datname LIKE 'ucell_jest_%'");
  for (const { datname } of candidates) {
    assert.match(datname, /^ucell_jest_[a-f0-9]{32}$/);
    const candidate = new URL(base); candidate.pathname = '/' + datname;
    const client = new PrismaClient({ datasources: { db: { url: candidate.href } } });
    const parameter = await client.runtimeRuleParameter.findFirst({ where: { ruleVersionCode: { startsWith: 'TEST_SCALE_1000_' } } });
    if (parameter) {
      if (db) { await client.$disconnect(); throw Error('AMBIGUOUS_SIMULATION_DATABASE'); }
      db = client; evidence.rule = parameter.ruleVersionCode;
    } else await client.$disconnect();
  }
  assert.ok(db, 'NO_SIMULATION_DATABASE');
  const deadline = Date.now() + 3600000;
  while (evidence.months.length < 3) {
    assert.ok(Date.now() < deadline, 'AUDIT_TIMEOUT');
    let source;
    try { source = JSON.parse(fs.readFileSync(path.join(logs, sourceFile), 'utf8')); }
    catch (error) {
      // The running suite writes progress synchronously; a reader can briefly
      // observe the file between truncate and write. Retry only that read race.
      if (!(error instanceof SyntaxError)) throw error;
      await new Promise(resolve => setTimeout(resolve, 250)); continue;
    }
    assert.notEqual(source.status, 'FAILED', 'SIMULATION_FAILED_BEFORE_COMPLETE_AUDIT');
    for (const month of source.months.slice(evidence.months.length)) {
      const index = evidence.months.length;
      const occurredAt = { gte: new Date(Date.UTC(2024, index, 1) - 8 * 3600000), lt: new Date(Date.UTC(2024, index + 1, 1) - 8 * 3600000) };
      const rpv = await db.pvLedger.aggregate({ where: { ruleVersionCode: evidence.rule, pvType: 'RPV', occurredAt }, _sum: { amount: true }, _count: { eventId: true } });
      const epv = await db.pvLedger.aggregate({ where: { ruleVersionCode: evidence.rule, pvType: 'EPV', occurredAt }, _sum: { amount: true }, _count: { eventId: true } });
      const rpvAwards = await db.rpvUplineAwardEvent.aggregate({ where: { ruleVersionCode: evidence.rule, occurredAt }, _sum: { payableAmount: true }, _count: { rpvAwardEventId: true } });
      const epvAwards = await db.bonusAward.aggregate({ where: { ruleVersionCode: evidence.rule, awardType: 'EPV', occurredAt }, _sum: { payableAmount: true }, _count: { bonusAwardId: true } });
      assert.equal(rpv._sum.amount.toString(), String(month.rpvEvents * 1200));
      assert.equal(rpv._count.eventId, month.rpvEvents);
      assert.equal(epv._sum.amount.toString(), String(month.epvTotal));
      assert.equal(rpvAwards._sum.payableAmount.toString(), String(month.rpvPayable));
      assert.equal(epvAwards._sum.payableAmount.toString(), String(month.epvPayable));
      assert.equal(rpvAwards._count.rpvAwardEventId, month.rpvAwards);
      assert.equal(epvAwards._count.bonusAwardId, month.epvAwards);
      evidence.months.push({ month: month.month, rpvVolume: rpv._sum.amount.toString(), rpvEvents: rpv._count.eventId,
        epvVolume: epv._sum.amount.toString(), epvEvents: epv._count.eventId,
        rpvPayable: rpvAwards._sum.payableAmount.toString(), epvPayable: epvAwards._sum.payableAmount.toString(), status: 'PASS' }); save();
    }
    if (evidence.months.length < 3) await new Promise(resolve => setTimeout(resolve, 250));
  }
  evidence.status = 'PASS'; save(); console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error); save(); throw error;
} finally { await db?.$disconnect(); await admin.$disconnect(); }
