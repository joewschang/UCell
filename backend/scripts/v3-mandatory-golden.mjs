import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const matrix = JSON.parse(readFileSync(new URL('./v3-mandatory-golden.matrix.json', import.meta.url), 'utf8'));
const api = ['pnpm', '--filter', '@ucell/api', 'exec', 'jest', '--config', './test/jest-e2e.json', '--runInBand'];
const commands = {
  'api-contract': [...api, '--runTestsByPath', 'test/v3-mandatory-contract.e2e-spec.ts'],
  'api-contract-and-bonus': [...api, '--runTestsByPath', 'test/v3-mandatory-contract.e2e-spec.ts', 'test/bonus-engine-v04.e2e-spec.ts'],
  'api-bonus': [...api, '--runTestsByPath', 'test/bonus-engine-v04.e2e-spec.ts'],
  'api-return-replay': [...api, '--runTestsByPath', 'test/a-decision-return.e2e-spec.ts'],
  'api-recovery': [...api, '--runTestsByPath', 'test/v3-mandatory-contract.e2e-spec.ts'],
  'api-db-recognition': [...api, '--runTestsByPath', 'test/recognition-active-db.e2e-spec.ts'],
  'api-db-gpv': [...api, '--runTestsByPath', 'test/gpv-immediate-effects-db.e2e-spec.ts'],
  'api-db-calendar': [...api, '--runTestsByPath', 'test/business-calendar-persistence-db.e2e-spec.ts'],
  'api-db-reservoir': [...api, '--runTestsByPath', 'test/global-pool-reservoir-db.e2e-spec.ts', 'test/epv-global-v05.e2e-spec.ts'],
};

const dbCommands = new Set(['api-db-recognition', 'api-db-gpv', 'api-db-calendar', 'api-db-reservoir']);
const url = process.env.V3_GOLDEN_DATABASE_URL ?? process.env.DATABASE_URL;
let dbBlocker = null;
let replayMigrationBlocker = null;
if (!url) dbBlocker = 'V3_GOLDEN_DATABASE_URL_OR_DATABASE_URL_REQUIRED';
else {
  try {
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || (!database.endsWith('_test')&&!/^ucell_jest_[a-f0-9]{32}$/.test(database)))
      dbBlocker = 'LOCAL_POSTGRES_DATABASE_NAME_MUST_END_WITH_TEST';
  } catch { dbBlocker = 'INVALID_DATABASE_URL'; }
}
if (!dbBlocker) {
  const probe = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await probe.$queryRawUnsafe(`SELECT finished_at, rolled_back_at, logs FROM public._prisma_migrations WHERE migration_name = '20260917230000_r1_0b_v3_replay_pool_deltas' ORDER BY started_at DESC LIMIT 1`);
    if (!rows[0]?.finished_at || rows[0]?.rolled_back_at) replayMigrationBlocker = 'MIGRATION_42_REPLAY_POOL_DELTAS_NOT_APPLIED';
  } catch { replayMigrationBlocker = 'MIGRATION_42_REPLAY_POOL_DELTAS_NOT_APPLIED'; }
  finally { await probe.$disconnect(); }
}

const outcomes = new Map();
for (const commandName of [...new Set(matrix.cases.map(item => item.command))]) {
  if (dbCommands.has(commandName) && dbBlocker) {
    outcomes.set(commandName, { status: 'BLOCKED', detail: dbBlocker });
    continue;
  }
  if (commandName === 'api-db-reservoir' && replayMigrationBlocker) {
    outcomes.set(commandName, { status: 'BLOCKED', detail: replayMigrationBlocker });
    continue;
  }
  const argv = commands[commandName];
  const executable = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : argv[0];
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', argv.join(' ')] : argv.slice(1);
  const result = spawnSync(executable, args, {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DATABASE_URL: url ?? '', PHASE2_TEST_DATABASE_URL: url ?? '', CALENDAR_PERSISTENCE_TEST_DATABASE_URL: url ?? '', GPV_IMMEDIATE_TEST_DATABASE_URL: url ?? '', GLOBAL_RESERVOIR_TEST_DATABASE_URL: url ?? '' },
  });
  const detail = result.error?.message ?? result.stderr ?? result.stdout ?? `process exited ${result.status}`;
  outcomes.set(commandName, { status: result.status === 0 ? 'PASS' : 'FAIL', detail: detail.trim() });
}

for (const item of matrix.cases) {
  const outcome = outcomes.get(item.command);
  console.log(`${item.id} ${outcome.status} - ${item.requirement}${outcome.status === 'BLOCKED' ? ` (${outcome.detail})` : ''}`);
}
for (const [name, outcome] of outcomes) if (outcome.status === 'FAIL') {
  console.error(`\n[${name}]\n${outcome.detail}`);
}
const failed = [...outcomes.values()].some(item => item.status === 'FAIL');
const blocked = [...outcomes.values()].some(item => item.status === 'BLOCKED');
console.log(`\nV3_MANDATORY_GOLDEN ${failed ? 'FAIL' : blocked ? 'BLOCKED' : 'PASS'}`);
process.exitCode = failed ? 1 : blocked ? 2 : 0;
