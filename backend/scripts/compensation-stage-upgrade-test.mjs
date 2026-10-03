import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(new URL('../package.json',import.meta.url)),{PrismaClient}=require('@prisma/client');
const databaseRequire=createRequire(new URL('../packages/database/package.json',import.meta.url));
const root=fileURLToPath(new URL('../',import.meta.url)),schemaRoot=join(root,'packages/database/prisma'),migration='20261002010000_compensation_stage_observation';
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const name='ucell_economic_upgrade_'+randomUUID().replaceAll('-',''),control=new URL(base),target=new URL(base);control.pathname='/postgres';target.pathname='/'+name;
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}}),scratch=mkdtempSync(join(tmpdir(),'ucell-stage-upgrade-'));let created=false;
const env={...process.env,DATABASE_URL:target.href};
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});assert.equal(r.status,0,'Upgrade child failed');}
const tables=['identity.person','identity.identity_link','identity.auth_session','organization.binary_tree','organization.binary_tree_status_event','organization.binary_tree_membership','organization.tree_canonical_position','membership.qualification','membership.qualification_owner_interval','membership.company_bootstrap_profile_binding','ledger.bonus_award','ledger.award_economic_destination','ledger.reservoir_b_effect'];
async function snapshot(){return Promise.all(tables.map(table=>db.$queryRawUnsafe(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY to_jsonb(t)::text`)));}
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(schemaRoot,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(schemaRoot,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<migration)cpSync(join(schemaRoot,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
 const prisma=databaseRequire.resolve('prisma/build/index.js');run([prisma,'migrate','deploy','--schema',join(scratch,'schema.prisma')]);
 const fixture=[require.resolve('ts-node/dist/bin.js'),'--project','apps/api/tsconfig.json','scripts/company-economic-upgrade-fixture.ts'];run([...fixture,'seed-current']);
 const before=await snapshot();cpSync(join(schemaRoot,'migrations',migration),join(scratch,'migrations',migration),{recursive:true});run([prisma,'migrate','deploy','--schema',join(scratch,'schema.prisma')]);assert.deepEqual(await snapshot(),before);console.log('STAGE_UPGRADE_EXISTING_ROWS_PRESERVED_PASS');
 const [empty]=await db.$queryRawUnsafe('SELECT (SELECT count(*) FROM integration.compensation_stage_observation)::int observations,(SELECT count(*) FROM integration.compensation_stage_watermark)::int watermarks');assert.deepEqual(empty,{observations:0,watermarks:0});
 const observed=await db.$queryRaw`SELECT * FROM integration.ucell_observe_compensation_stage(${new Date('2026-09-01Z')},${new Date('2026-10-01Z')},${'R1.0B'},${'PRECHECK'},${new Date(Date.now()-1000)},${'a'.repeat(64)})`;assert.equal(observed.length,1);assert.equal(observed[0].revision,1);assert.equal(observed[0].previous_stage,null);await assert.rejects(db.$executeRaw`DELETE FROM integration.compensation_stage_observation WHERE observation_id=${observed[0].observation_id}::uuid`);assert.deepEqual(await snapshot(),before);console.log('COMPENSATION_STAGE_127_TO_128_UPGRADE_PASS');
}finally{
 await db.$disconnect();if(created){assert.match(name,/^ucell_economic_upgrade_[a-f0-9]{32}$/);await admin.$executeRawUnsafe('DROP DATABASE "'+name+'" WITH (FORCE)');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-stage-upgrade-'));rmSync(scratch,{recursive:true,force:true});console.log('COMPENSATION_STAGE_UPGRADE_CLEANUP_PASS');
}
