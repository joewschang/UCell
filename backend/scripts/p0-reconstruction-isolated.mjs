import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const base = new URL(process.env.DATABASE_URL ?? 'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname), 'P0 isolation only permits local PostgreSQL');
const database = 'ucell_p0_reconstruction_' + randomUUID().replaceAll('-', '');
const control = new URL(base); control.pathname = '/postgres';
const target = new URL(base); target.pathname = '/' + database;
const cwd = fileURLToPath(new URL('../', import.meta.url));
const admin = new PrismaClient({ datasources: { db: { url: control.href } } });
let created = false;
try {
  await admin.$executeRawUnsafe('CREATE DATABASE "' + database + '"');
  created = true;
  const migrate = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', 'packages/database/prisma/schema.prisma'], { cwd, env: { ...process.env, DATABASE_URL: target.href }, stdio: 'inherit' });
  assert.equal(migrate.status, 0, 'P0 isolated migration failed');
  const dryRun = spawnSync(process.execPath, ['scripts/p0-identifier-reconstruction-dry-run.mjs'], { cwd, env: { ...process.env, DATABASE_URL: target.href }, stdio: 'inherit' });
  assert.equal(dryRun.status, 0, 'P0 reconstruction dry-run failed');
  console.log('P0_RECONSTRUCTION_DRY_RUN_PASS');
} finally {
  if (created) {
    await admin.$executeRawUnsafe('DROP DATABASE "' + database + '" WITH (FORCE)');
    console.log('P0_RECONSTRUCTION_DRY_RUN_CLEANUP_PASS');
  }
  await admin.$disconnect();
}
