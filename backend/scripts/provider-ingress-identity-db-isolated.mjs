import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const base = new URL(process.env.DATABASE_URL ?? 'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname), 'Provider identity assertions only permit local PostgreSQL');
const database = `ucell_provider_identity_${randomUUID().replaceAll('-', '')}`;
const controlUrl = new URL(base); controlUrl.pathname = '/postgres';
const targetUrl = new URL(base); targetUrl.pathname = `/${database}`;
const admin = new PrismaClient({ datasources: { db: { url: controlUrl.href } } });
const env = { ...process.env, DATABASE_URL: targetUrl.href };
const cwd = fileURLToPath(new URL('../', import.meta.url));
function run(args) { const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' }); if (result.error) throw result.error; assert.equal(result.status, 0, 'Provider identity assertion child failed'); }
let created = false;
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`); created = true;
  run([require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', 'packages/database/prisma/schema.prisma']);
  run(['scripts/provider-ingress-identity-db-test.mjs']);
  console.log('PROVIDER_INGRESS_IDENTITY_DB_ISOLATED_PASS: fresh migrated database');
} finally {
  if (created) { await admin.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`); console.log('PROVIDER_INGRESS_IDENTITY_DB_ISOLATED_CLEANUP_PASS'); }
  await admin.$disconnect();
}
