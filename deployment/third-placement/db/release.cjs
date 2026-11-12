'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const migrationName = '20261112160000_third_direct_either_side';
const previousBodyHash = '8b58edee21ae7ee2b6d7e4bacc612502c913e4c1addd09471958ed15246013ec';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const normalize = text => text.replace(/\r\n/g, '\n');

async function functionBody(tx) {
  const rows = await tx.$queryRawUnsafe(`SELECT p.prosrc FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_proc p ON t.tgfoid=p.oid
    WHERE t.tgrelid='organization.binary_placement'::regclass AND NOT t.tgisinternal
      AND t.tgname='trg_binary_first_third_left' AND t.tgenabled IN ('O','A')
      AND p.oid='organization.ucell_guard_first_third_left()'::regprocedure`);
  if (rows.length !== 1) throw Error('Unexpected placement trigger binding');
  return sha(normalize(rows[0].prosrc));
}

async function run(db, rawSql, mode) {
  if (!['trial', 'apply', 'verify'].includes(mode)) throw Error('Use trial, apply or verify');
  const sql = normalize(rawSql);
  const body = /AS \$\$([\s\S]*?)\$\$;\s*$/.exec(sql);
  if (!body) throw Error('Expected one PostgreSQL function definition');
  const expectedBody = sha(body[1]);
  const rollback = new Error('Trial complete');
  let status;
  try {
    await db.$transaction(async tx => {
      if (mode === 'verify') {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      } else {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='10s'");
        await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('ucell.third-placement.release'))::text");
      }
      const before = await functionBody(tx);
      const state = await tx.$queryRawUnsafe(`SELECT finished_at, checksum FROM public._prisma_migrations
        WHERE migration_name=$1 AND rolled_back_at IS NULL`, migrationName);
      if (state.length) {
        if (state.length !== 1 || !state[0].finished_at || ![sha(sql), sha(sql.replace(/\n/g,'\r\n'))].includes(state[0].checksum) || before !== expectedBody)
          throw Error('Database migration record and installed guard differ');
        status = 'installed';
        return;
      }
      if (mode === 'verify' || before !== previousBodyHash) throw Error('Unexpected migration baseline');
      await tx.$executeRawUnsafe(sql);
      if (await functionBody(tx) !== expectedBody) throw Error('Installed guard differs from release');
      await tx.$executeRawUnsafe(`INSERT INTO public._prisma_migrations
        (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
        VALUES ($1,$2,clock_timestamp(),$3,transaction_timestamp(),1)`, crypto.randomUUID(), sha(sql), migrationName);
      status = mode === 'trial' ? 'rolled back' : 'applied';
      if (mode === 'trial') throw rollback;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return { migration: migrationName, status };
}

module.exports = { run };
if (require.main === module) {
  const { PrismaClient } = require('/app/packages/database/node_modules/@prisma/client');
  const db = new PrismaClient();
  const file = process.argv[3] || path.resolve(__dirname, '../../../backend/packages/database/prisma/migrations', migrationName, 'migration.sql');
  run(db, fs.readFileSync(file, 'utf8'), process.argv[2]).then(result => console.log(result))
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => db.$disconnect());
}
