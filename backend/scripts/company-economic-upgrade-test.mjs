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
const root=fileURLToPath(new URL('../',import.meta.url)),schemaRoot=join(root,'packages/database/prisma'),migration='20261001060000_profile_company_economic_position';
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const name='ucell_economic_upgrade_'+randomUUID().replaceAll('-',''),control=new URL(base),target=new URL(base);control.pathname='/postgres';target.pathname='/'+name;
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}}),scratch=mkdtempSync(join(tmpdir(),'ucell-economic-upgrade-'));let created=false;
const env={...process.env,DATABASE_URL:target.href};
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});assert.equal(r.status,0,'Upgrade child failed');}
const tables=['identity.person','identity.identity_link','identity.auth_session','organization.binary_tree','organization.binary_tree_status_event','organization.binary_tree_membership','organization.tree_canonical_position','membership.qualification','membership.qualification_owner_interval','membership.company_bootstrap_profile_binding','ledger.bonus_award','ledger.award_economic_destination','ledger.reservoir_b_effect'];
async function snapshot(){return Promise.all(tables.map(table=>db.$queryRawUnsafe(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY to_jsonb(t)::text`)));}
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(schemaRoot,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(schemaRoot,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<migration)cpSync(join(schemaRoot,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
 const prisma=databaseRequire.resolve('prisma/build/index.js');run([prisma,'migrate','deploy','--schema',join(scratch,'schema.prisma')]);
 const fixture=[require.resolve('ts-node/dist/bin.js'),'--project','apps/api/tsconfig.json','scripts/company-economic-upgrade-fixture.ts'];run([...fixture,'seed']);
 const before=await snapshot();run([prisma,'migrate','deploy','--schema',join(schemaRoot,'schema.prisma')]);assert.deepEqual(await snapshot(),before);console.log('ECONOMIC_UPGRADE_EXISTING_ROWS_PRESERVED_PASS');
 run([...fixture,'verify']);console.log('COMPANY_ECONOMIC_126_TO_127_UPGRADE_PASS');
}finally{
 await db.$disconnect();if(created){assert.match(name,/^ucell_economic_upgrade_[a-f0-9]{32}$/);await admin.$executeRawUnsafe('DROP DATABASE "'+name+'" WITH (FORCE)');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-economic-upgrade-'));rmSync(scratch,{recursive:true,force:true});console.log('COMPANY_ECONOMIC_UPGRADE_CLEANUP_PASS');
}
