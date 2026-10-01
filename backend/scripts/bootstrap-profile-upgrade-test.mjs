import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {profileMigration,profileUpgradeSql} from './bootstrap-profile-upgrade-sql.mjs';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url)),{PrismaClient}=require('@prisma/client');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const database='ucell_profile_upgrade_'+randomUUID().replaceAll('-',''),control=new URL(base),target=new URL(base);control.pathname='/postgres';target.pathname='/'+database;
const root=fileURLToPath(new URL('../',import.meta.url)),prismaRoot=join(root,'packages/database/prisma'),scratch=mkdtempSync(join(tmpdir(),'ucell-profile-upgrade-'));
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});let created=false;
function run(args,schema=join(prismaRoot,'schema.prisma'),input){return spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),...args,'--schema',schema],{cwd:root,env:{...process.env,DATABASE_URL:target.href},input,encoding:'utf8'});}
function pass(result){assert.equal(result.status,0,result.stderr);}
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(prismaRoot,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const e of readdirSync(join(prismaRoot,'migrations'),{withFileTypes:true}))if(!e.isDirectory()||e.name<profileMigration)cpSync(join(prismaRoot,'migrations',e.name),join(scratch,'migrations',e.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;pass(run(['migrate','deploy'],join(scratch,'schema.prisma')));
 // Minimal synthetic legacy tree rows isolate the migration/lifecycle boundary.
 // Only the bootstrap fixture constraint is bypassed during fixture insertion;
 // lifecycle protection stays enabled throughout reproduction and recovery.
 await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('ALTER TABLE organization.binary_tree DISABLE TRIGGER tree_bootstrap_complete');
  for(const [status,version] of [['ACTIVE',7],['ARCHIVED',11]])await tx.$executeRawUnsafe(`INSERT INTO organization.binary_tree(binary_tree_id,tree_code,tree_name,status,topology_version,company_principal_id,created_by_actor_id,effective_at) SELECT gen_random_uuid(),'UPGRADE_${status}','Historical ${status}','${status}',${version},company_principal_id,gen_random_uuid(),'2020-01-01Z' FROM membership.company_principal WHERE code='UCELL_COMPANY'`);
  const trees=await tx.$queryRawUnsafe('SELECT * FROM organization.binary_tree');
  for(const tree of trees){
   await tx.binaryTreeStatusEvent.create({data:{binaryTreeId:tree.binary_tree_id,status:tree.status,topologyVersion:tree.topology_version,treeName:tree.tree_name,actorId:tree.created_by_actor_id,reason:'SYNTHETIC UPGRADE',effectiveAt:tree.effective_at,correlationId:randomUUID(),evidenceHash:'a'.repeat(64)}});
   await tx.binaryTreeProjectionCheckpoint.create({data:{binaryTreeId:tree.binary_tree_id,sourceVersion:tree.topology_version,generation:randomUUID(),status:'READY',dataThrough:tree.effective_at}});
  }
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
  await tx.$executeRawUnsafe('ALTER TABLE organization.binary_tree ENABLE TRIGGER tree_bootstrap_complete');
 });
 const before=await db.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM organization.binary_tree t ORDER BY tree_code');assert.equal(before.length,2);
 const person=await db.person.create({data:{legalName:'SYNTHETIC PROFILE MIGRATION'}});
 const failed=run(['migrate','deploy']);assert.notEqual(failed.status,0);assert.match(failed.stderr,/TREE_IMMUTABLE_IDENTITY_OR_VERSION/);
 assert.deepEqual(await db.$queryRawUnsafe("SELECT to_regclass('organization.binary_tree_bootstrap_profile') IS NULL AS absent"),[{absent:true}]);
 pass(run(['db','execute','--stdin'],undefined,profileUpgradeSql()));
 const after=await db.$queryRawUnsafe("SELECT to_jsonb(t)-ARRAY['bootstrap_profile_id','bootstrap_profile_code','bootstrap_company_ball_count','bootstrap_profile_snapshot'] AS row FROM organization.binary_tree t ORDER BY tree_code");assert.deepEqual(after,before);
 assert.deepEqual(await db.person.findUnique({where:{personId:person.personId}}),person);
 await assert.rejects(db.$executeRawUnsafe("UPDATE organization.binary_tree SET tree_name='Invalid' WHERE status='ACTIVE'"),/TREE_IMMUTABLE_IDENTITY_OR_VERSION/);
 await assert.rejects(db.$executeRawUnsafe("UPDATE organization.binary_tree SET topology_version=topology_version+1 WHERE status='ARCHIVED'"),/TREE_IMMUTABLE_IDENTITY_OR_VERSION/);
 await assert.rejects(db.$executeRawUnsafe('DELETE FROM organization.binary_tree'),/TREE_DELETE_FORBIDDEN/);
 pass(run(['migrate','resolve','--rolled-back',profileMigration]));pass(run(['migrate','resolve','--applied',profileMigration]));pass(run(['migrate','deploy']));
 assert.deepEqual(await db.$queryRawUnsafe("SELECT to_jsonb(t)-ARRAY['bootstrap_profile_id','bootstrap_profile_code','bootstrap_company_ball_count','bootstrap_profile_snapshot'] AS row FROM organization.binary_tree t ORDER BY tree_code"),before);
 assert.deepEqual(await db.person.findUnique({where:{personId:person.personId}}),person);
 const ledger=await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');assert.equal(ledger[0].count,124);
 console.log('BOOTSTRAP_PROFILE_UPGRADE_PASS: reproduced failed migration; 87 to 124; legacy/archived identity, topology versions and Person preserved; lifecycle/delete guards remain enforced');
}finally{
 await db.$disconnect();if(created){assert.match(database,/^ucell_profile_upgrade_[a-f0-9]{32}$/);await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-profile-upgrade-'));rmSync(scratch,{recursive:true,force:true});console.log('BOOTSTRAP_PROFILE_UPGRADE_CLEANUP_PASS');
}
