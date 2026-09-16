import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname),'Golden only permits local DEV PostgreSQL');
const database='ucell_dev_golden_'+randomUUID().replaceAll('-','');
assert.match(database,/^ucell_dev_golden_[a-f0-9]{32}$/);
const controlUrl=new URL(base);controlUrl.pathname='/postgres';
const admin=new PrismaClient({datasources:{db:{url:controlUrl.href}}});
const target=new URL(base);target.pathname='/'+database;
const env={...process.env,DATABASE_URL:target.href,GOLDEN_ISOLATION_DATABASE:database};
const cwd=fileURLToPath(new URL('../',import.meta.url));
function run(args){const result=spawnSync(process.execPath,args,{cwd,env,stdio:'inherit'});if(result.error)throw result.error;assert.equal(result.status,0,'Golden child gate failed');}
let created=false;
try{
  await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;
  run([require.resolve('prisma/build/index.js'),'migrate','deploy','--schema','packages/database/prisma/schema.prisma']);
  run(['scripts/db-golden-fixtures.mjs']);
  run(['-r','ts-node/register','scripts/db-golden-e2e.ts']);
  run(['scripts/phase3-concurrency-db-test.mjs']);
  run(['scripts/phase3-return-outbox-db-test.mjs']);
  run(['scripts/phase3-membership-db-test.mjs']);
  run(['scripts/phase3-rpv-concurrency-db-test.mjs']);
  run(['scripts/system-assignment-db-test.mjs']);
  run(['scripts/phase3-member-identity-db-test.mjs']);
  console.log('DB_GOLDEN_ISOLATED_PASS: fresh database, deployed migrations, deterministic fixtures');
}finally{
  // Only this successfully-created random test database is removed.
  if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'"');console.log('DB_GOLDEN_ISOLATED_CLEANUP_PASS');}
  await admin.$disconnect();
}
