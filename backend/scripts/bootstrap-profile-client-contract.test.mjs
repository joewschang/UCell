import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {Prisma}=require('@prisma/client');
test('generated client preserves textual tree identity separately from registry version',()=>{
 const models=Prisma.dmmf.datamodel.models;
 const identity=models.find(m=>m.name==='BinaryTree').fields.find(f=>f.name==='bootstrapProfileVersion');
 assert.equal(identity.type,'String');assert.equal(identity.dbName,'bootstrap_profile_version');
 const version=models.find(m=>m.name==='BinaryTreeBootstrapProfile').fields.find(f=>f.name==='version');
 assert.equal(version.type,'Int');
 const legacy=readFileSync(new URL('../packages/database/prisma/migrations/20260919040000_multi_tree_nonmonetary/migration.sql',import.meta.url),'utf8');
 assert.match(legacy,/"bootstrap_profile_version" TEXT NOT NULL DEFAULT 'COMPANY_BOOTSTRAP_PROFILE_V1'/);
});
