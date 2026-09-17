import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStageSeedEnvironment, assertSafeArguments, OPT_IN } from './stage-uat-seed.mjs';

const valid = { UCELL_ENVIRONMENT: 'STAGE', UCELL_STAGE_UAT_SEED_OPT_IN: OPT_IN, DATABASE_URL: 'postgresql://user:pass@ucell-stage.postgres.database.azure.com:5432/ucell_stage?sslmode=require' };
assert.deepEqual(validateStageSeedEnvironment(valid), { host: 'ucell-stage.postgres.database.azure.com', database: 'ucell_stage' });
for (const env of [
  { ...valid, UCELL_ENVIRONMENT: 'PRODUCTION' }, { ...valid, UCELL_STAGE_UAT_SEED_OPT_IN: '' },
  { ...valid, DATABASE_URL: 'postgresql://user:pass@localhost:5432/ucell_stage' },
  { ...valid, DATABASE_URL: 'postgresql://user:pass@ucell-stage.postgres.database.azure.com:5432/production' },
  { ...valid, DATABASE_URL: 'postgresql://user:pass@evil.example/ucell_stage' },
]) assert.throws(() => validateStageSeedEnvironment(env));
assert.throws(() => assertSafeArguments(['--reset']));
assert.throws(() => assertSafeArguments(['drop']));
assert.doesNotThrow(() => assertSafeArguments([]));
const source = readFileSync(new URL('./stage-uat-seed.mjs', import.meta.url), 'utf8');
assert.ok(!/bonusAward|pvLedger|payableEntry|ledger\./i.test(source), 'seed must not write monetary award or ledger models');
assert.ok(!/TEST_ONLY|golden-r1/i.test(source), 'seed must not create Golden/test-only facts');
for (const model of ['person', 'qualification', 'productReference', 'order', 'orderLine', 'warehouse', 'inventoryItem', 'inventoryBalance']) {
  assert.ok(source.includes(`tx.${model}.upsert(`), `${model} must use idempotent upsert`);
}
assert.ok(!/tx\.[A-Za-z]+\.(delete|deleteMany|createMany)\(/.test(source), 'seed must not delete, reset, or bulk-create records');
console.log('STAGE_UAT_SEED_TEST_PASS: environment guards, destructive arguments, and forbidden model checks');
