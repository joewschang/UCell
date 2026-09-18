import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const base = new URL(process.env.DATABASE_URL ?? 'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname), 'Member Explain DB tests require local PostgreSQL');
const database = 'ucell_explain_' + randomUUID().replaceAll('-', '');
assert.match(database, /^ucell_explain_[a-f0-9]{32}$/);
const control = new URL(base); control.pathname = '/postgres';
const target = new URL(base); target.pathname = '/' + database;
const admin = new PrismaClient({ datasources: { db: { url: control.href } } });
const cwd = fileURLToPath(new URL('../', import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd, env: { ...process.env, DATABASE_URL: target.href }, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Member Explain isolated child failed');
}
let created = false;
try {
  await admin.$executeRawUnsafe('CREATE DATABASE "' + database + '"');
  created = true;
  run([require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', 'packages/database/prisma/schema.prisma']);
  run(['scripts/member-explain-db-test.mjs']);
  run(['scripts/member-explain-http-db-test.mjs']);
  console.log('MEMBER_EXPLAIN_DB_ISOLATED_PASS');
} finally {
  try {
    if (created) {
      await admin.$executeRawUnsafe('DROP DATABASE "' + database + '" WITH (FORCE)');
      console.log('MEMBER_EXPLAIN_DB_ISOLATED_CLEANUP_PASS');
    }
  } finally { await admin.$disconnect(); }
}
