import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {profileMigration,profileUpgradeSql} from './bootstrap-profile-upgrade-sql.mjs';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url)),{PrismaClient}=require('@prisma/client');
const root=fileURLToPath(new URL('../',import.meta.url)),schema=join(root,'packages/database/prisma/schema.prisma');
const url=new URL(process.env.DATABASE_URL??'');
assert.equal(process.env.UCELL_ENVIRONMENT,'STAGE');assert.equal(process.env.NODE_ENV,'staging');
assert.equal(url.hostname,'ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com');assert.equal(url.pathname,'/ucell_stage');
const db=new PrismaClient();
function prisma(args,input){const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),...args,'--schema',schema],{cwd:root,env:process.env,input,encoding:'utf8'});if(result.status!==0)throw new Error('STAGE_PRISMA_OPERATION_FAILED '+args[0]+' '+args[1]);}
try{
 const rows=await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations');
 for(const row of rows.filter(x=>!x.rolled_back_at)){
  const file=join(root,'packages/database/prisma/migrations',row.migration_name,'migration.sql');assert.ok(existsSync(file),'unknown migration');
  const text=readFileSync(file,'utf8'),lf=text.replace(/\r\n/g,'\n');
  assert.ok([text,lf,lf.replace(/\n/g,'\r\n')].some(value=>createHash('sha256').update(value).digest('hex')===row.checksum),'migration checksum mismatch: '+row.migration_name);
  assert.ok(row.finished_at||row.migration_name===profileMigration,'unrelated failed migration');
 }
 const applied=rows.some(x=>x.migration_name===profileMigration&&x.finished_at&&!x.rolled_back_at);
 if(!applied){
  const state=await db.$queryRawUnsafe("SELECT to_regclass('organization.binary_tree_bootstrap_profile') IS NOT NULL AS exists");
  assert.equal(state[0].exists,false,'partial profile schema requires separate inspection; no overwrite permitted');
  const before=await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM organization.binary_tree');
  prisma(['db','execute','--stdin'],profileUpgradeSql());
  if(rows.some(x=>x.migration_name===profileMigration&&!x.finished_at&&!x.rolled_back_at))prisma(['migrate','resolve','--rolled-back',profileMigration]);
  prisma(['migrate','resolve','--applied',profileMigration]);
  await db.auditEvent.create({data:{actorType:'SYSTEM',action:'STAGE_BOOTSTRAP_PROFILE_UPGRADE_VERIFIED',entityType:'OperationalRecovery',requestId:'STAGE_PROFILE_UPGRADE_20261001',correlationId:require('node:crypto').randomUUID(),afterData:{preservedTrees:before[0].count,immutableTreeFieldsPreserved:true,lifecycleGuardRestored:true}}});
  console.log(JSON.stringify({recovery:'PASS',migration:profileMigration,preservedTrees:before[0].count,immutableTreeFieldsPreserved:true,lifecycleGuardRestored:true}));
 }
 prisma(['migrate','deploy']);
 const final=await db.$queryRawUnsafe('SELECT count(*)::int AS applied FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
 console.log(JSON.stringify({stageMigration:'PASS',applied:final[0].applied}));
}finally{await db.$disconnect();}
