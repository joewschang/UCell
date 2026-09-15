import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../..');
const out=path.join(dir,'final');
const results=JSON.parse(fs.readFileSync(path.join(out,'gate-results.json')));
const env={...process.env,NODE_ENV:'development',ADMIN_AUTH_BYPASS:'true',UCELL_ADMIN_DEV_FULL_ACCESS:'true',UCELL_ADMIN_DEV_READ_ONLY:'false',DATABASE_URL:'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell_admin_test?schema=public'};
function run(area,command,label,overrides={},expected=0){
  const cwd=path.join(root,area); const start=new Date().toISOString();
  const r=spawnSync('cmd.exe',['/d','/s','/c',command],{cwd,env:{...env,...overrides},encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
  const output=`${r.stdout??''}${r.stderr??''}${r.error?.message??''}`;
  fs.writeFileSync(path.join(out,label+'.txt'),`command: ${command}\nstarted: ${start}\nexit: ${r.status}\nexpected: ${expected}\n${output}`);
  if(expected===1){assert.equal(r.status,1,label);assert.ok(output.includes('ADMIN_DEV_START_BLOCKED'),label);}
  results.push({label,cwd,command,start,exitCode:r.status,expectedExit:expected,result:r.status===expected?'PASS':'FAIL'});
}
run('backend','pnpm --filter @ucell/api build:admin-dev','full-admin-dev-build');
run('backend','pnpm -r build','backend-build-after-idempotency');
run('backend','pnpm test','tests-after-idempotency');
run('backend','node scripts/security-policy-preflight.mjs','security-after-idempotency');
run('backend','node scripts/test-todo-gate.mjs','todo-after-idempotency');
run('admin','pnpm build','hardened-admin-build',{VITE_ENABLE_DEMO_LOGIN:'true',VITE_ADMIN_DEV_FULL_ACCESS:'true'});
for(const [label,config] of [
 ['production-full-start-rejected',{NODE_ENV:'production'}],
 ['original-dev-db-full-start-rejected',{DATABASE_URL:'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell?schema=public'}],
 ['remote-db-full-start-rejected',{DATABASE_URL:'postgresql://ucell:ucell_dev@remote.invalid:5432/ucell_admin_test'}],
 ['bypass-disabled-full-start-rejected',{ADMIN_AUTH_BYPASS:'false'}],
])run('backend/apps/api','node dist-admin-dev/admin-dev.js',label,config,1);
const todos=JSON.parse(fs.readFileSync(path.join(out,'todo-inventory.json')));assert.equal(todos.length,148);
const diff=spawnSync('git',['diff','df13581','--','backend/packages/database/prisma','backend/packages/shared/src/r1-0b-golden.ts',...new Set(todos.map(row=>row.file))],{cwd:root,encoding:'utf8'});
assert.equal(diff.status,0);assert.equal(diff.stdout.trim(),'');
fs.writeFileSync(path.join(out,'preservation-check.txt'),'PASS: original schema/migrations/seed/frozen constants and all original TODO files unchanged.\n');
fs.writeFileSync(path.join(out,'gate-results.json'),JSON.stringify(results,null,2)+'\n');
fs.writeFileSync(path.join(out,'PASS-FAIL-MATRIX.md'),'| Gate | Result | Exit | Expected Exit | Command |\n| --- | --- | --- | --- | --- |\n'+results.map(row=>`| ${row.label} | ${row.result} | ${row.exitCode} | ${row.expectedExit??0} | ${row.command} |`).join('\n')+'\n');
console.log('FULL ADMIN verification matrix and startup boundaries recorded');
