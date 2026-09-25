// Apply pending migrations, including Ball Number Sequence V2, to an explicitly
// local database. This helper never targets a remote host and is never invoked
// by a release/deployment command.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const url=new URL(process.env.DATABASE_URL ?? '');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname),'Explicit local DATABASE_URL required');
const schema=fileURLToPath(new URL('../packages/database/prisma/schema.prisma',import.meta.url));
const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{env:process.env,stdio:'inherit'});
if(result.error)throw result.error;
assert.equal(result.status,0,'Local migration deployment failed');
