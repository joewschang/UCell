import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const out = path.join(dir, 'final');
const results = JSON.parse(fs.readFileSync(path.join(out, 'gate-results.json')));
const devEnv = { ...process.env, DATABASE_URL: 'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell?schema=public',
  NODE_ENV: 'development', ADMIN_AUTH_BYPASS: 'true', UCELL_ADMIN_DEV_READ_ONLY: 'true' };
function run(area, command, label, env = devEnv, expected = 0) {
  const cwd = path.join(root, area);
  const start = new Date().toISOString();
  const r = spawnSync('cmd.exe', ['/d', '/s', '/c', command], { cwd, env, encoding: 'utf8', timeout: 180000, maxBuffer: 16*1024*1024 });
  const output = `${r.stdout??''}${r.stderr??''}${r.error?.message??''}`;
  fs.writeFileSync(path.join(out, label+'.txt'), `command: ${command}\nstarted: ${start}\nexpected exit: ${expected}\nexit: ${r.status}\n${output}`);
  if (expected !== 0) {
    assert.equal(r.status, expected, label);
    assert.ok(output.includes('ADMIN_DEV_START_BLOCKED'), label);
  }
  results.push({label,cwd,command,start,exitCode:r.status,expectedExit:expected,result:r.status===expected?'PASS':'FAIL'});
}
run('backend','pnpm --filter @ucell/database exec prisma generate','prisma-generate-after-stop');
run('backend','pnpm --filter @ucell/api build:admin-dev','admin-dev-build');
run('admin','pnpm build','admin-build-final');
run('admin','pnpm test','admin-tests-final');
for (const [label, overrides] of [
  ['production-start-rejected',{NODE_ENV:'production'}],
  ['missing-demo-start-rejected',{ADMIN_AUTH_BYPASS:'false'}],
  ['remote-db-start-rejected',{DATABASE_URL:'postgresql://ucell:ucell_dev@remote.invalid:5432/ucell'}],
]) run('backend/apps/api','node dist-admin-dev/admin-dev.js',label,{...devEnv,...overrides},1);
const todos = JSON.parse(fs.readFileSync(path.join(out,'todo-inventory.json')));
const preserved = ['backend/packages/database/prisma','backend/packages/shared/src/r1-0b-golden.ts',...new Set(todos.map(r=>r.file))];
const diff = spawnSync('git',['diff','df13581','--',...preserved],{cwd:root,encoding:'utf8'});
assert.equal(diff.status,0); assert.equal(diff.stdout.trim(),''); assert.equal(todos.length,148);
fs.writeFileSync(path.join(out,'preservation-check.txt'),'PASS: schema/migrations/seed/shared constants and 148 original TODO unchanged versus df13581.\n');
fs.writeFileSync(path.join(out,'gate-results.json'),JSON.stringify(results,null,2)+'\n');
fs.writeFileSync(path.join(out,'PASS-FAIL-MATRIX.md'),'| Gate | Result | Exit | Expected Exit | Command |\n| --- | --- | --- | --- | --- |\n'+results.map(r=>`| ${r.label} | ${r.result} | ${r.exitCode} | ${r.expectedExit??0} | ${r.command} |`).join('\n')+'\n');
console.log('Matrix updated; original generate EPERM evidence retained; final retry and DEV startup boundaries recorded');
