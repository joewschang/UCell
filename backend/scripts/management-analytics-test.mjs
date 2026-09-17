import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const dbRequire=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {PrismaClient}=dbRequire('@prisma/client');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname),'Only local test PostgreSQL is permitted');
const database='ucell_analytics_test_'+randomUUID().replaceAll('-','');
assert.match(database,/^ucell_analytics_test_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const db=new PrismaClient({datasources:{db:{url:control.href}}}),env={...process.env,DATABASE_URL:target.href};
function run(args,dir){const result=spawnSync(process.execPath,args,{cwd:fileURLToPath(new URL(dir,import.meta.url)),env,stdio:'inherit'});if(result.error)throw result.error;assert.equal(result.status,0,'Analytics test child failed');}
let created=false;
try{
  await db.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;
  run([dbRequire.resolve('prisma/build/index.js'),'migrate','deploy','--schema','packages/database/prisma/schema.prisma'],'../');
  run([require.resolve('jest/bin/jest'),'--config','test/jest-e2e.json','--testRegex','test/analytics-((policy|history|refresh|volume).e2e-spec|db.integration)\\.ts$','--runInBand'],'../apps/api/');
  console.log('MANAGEMENT_ANALYTICS_DB_HTTP_PASS');
}finally{
  if(created)await db.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');
  await db.$disconnect();
}
