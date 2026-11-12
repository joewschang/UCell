'use strict';
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const names = require('./migrations.json');

function statements(sql) {
  // PostgreSQL bodies, quoted strings and identifiers may contain semicolons.
  const tokens = /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|(\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$)[\s\S]*?\1|;/g;
  const result = [];
  let start = 0;
  for (const token of sql.matchAll(tokens)) {
    if (token[0] === ';') {
      if (sql.slice(start, token.index).trim()) result.push(sql.slice(start, token.index));
      start = token.index + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail && !/^(?:--[^\n]*(?:\n|$)\s*)+$/.test(tail)) result.push(tail);
  return result;
}

function loadMigrations(folder) {
  return names.map(name => {
    const sql = fs.readFileSync(path.join(folder, name, 'migration.sql'), 'utf8').replace(/\r\n/g, '\n');
    const checksum = text => createHash('sha256').update(text).digest('hex');
    return { name, sql, checksum: checksum(sql), windowsChecksum: checksum(sql.replace(/\n/g, '\r\n')) };
  });
}

async function inspect(tx, migration) {
  const records = await tx.$queryRawUnsafe('SELECT checksum, finished_at, rolled_back_at FROM public._prisma_migrations WHERE migration_name=$1 AND rolled_back_at IS NULL', migration.name);
  if (!records.length) return 'pending';
  if (records.length !== 1 || !records[0].finished_at ||
      ![migration.checksum, migration.windowsChecksum].includes(records[0].checksum)) {
    throw Error('Incomplete or different migration: ' + migration.name);
  }
  return 'installed';
}

async function verify(tx) {
  const expected = [
    ['membership.enrollment_bundle','keep_enrollment_plan_code'],
    ['membership.enrollment_bundle_ball','excellence_plan_position'],
    ['commerce.enrollment_bundle_allocation','combined_allocation_binding'],
    ['commerce.enrollment_bundle_payment','enrollment_bundle_receipt_allocation'],
    ['commerce."order"','enrollment_bundle_order_payment'],
    ['commerce."order"','keep_verified_enrollment_order'],
    ['membership.qualification','funded_bundle_activation'],
  ];
  for (const [table, trigger] of expected) {
    const [check] = await tx.$queryRawUnsafe("SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass($1) AND tgname=$2 AND tgenabled IN ('O','A')) AS enabled", table, trigger);
    if (!check.enabled) throw Error('Migration postcondition failed: ' + trigger);
  }
}

async function run(db, folder, mode) {
  if (!['--check','--trial','--apply'].includes(mode)) throw Error('Expected --check, --trial or --apply');
  const migrations = loadMigrations(folder);
  const changes = [];
  const rollback = new Error('ROLLBACK_RELEASE_TRIAL');
  try {
    await db.$transaction(async tx => {
      if (mode === '--check') {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      } else {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='10s'");
        await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('ucell.enrollment_bundle.release'))::text");
      }
      for (const migration of migrations) {
        const status = await inspect(tx, migration);
        if (status !== 'pending') continue;
        changes.push(migration.name);
        if (mode === '--check') continue;
        for (const sql of statements(migration.sql)) await tx.$executeRawUnsafe(sql);
        await tx.$executeRawUnsafe('INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES($1,$2,clock_timestamp(),$3,transaction_timestamp(),1)', randomUUID(), migration.checksum, migration.name);
      }
      if (mode !== '--check') await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      if (mode !== '--check' || !changes.length) await verify(tx);
      if (mode === '--trial') throw rollback;
    }, { timeout: 120000, maxWait: 10000 });
  } catch (err) {
    if (err !== rollback) throw err;
  }
  return { mode, changes };
}

if (require.main === module) {
  const { PrismaClient } = require(process.env.ENROLLMENT_PRISMA_CLIENT || '/app/packages/database/node_modules/@prisma/client');
  const db = new PrismaClient();
  const migrationDir = process.argv[3] || path.join(__dirname, 'migrations');
  run(db, migrationDir, process.argv[2] || '--check')
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/ig, '[database]')); process.exitCode = 1; })
    .finally(() => db.$disconnect());
}
module.exports = { statements, loadMigrations, run };

