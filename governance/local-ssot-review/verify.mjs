import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const out=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(out,'../..');
const cwd=path.join(root,'backend');
const results=[];
function run(command,label){
  const r=spawnSync('cmd.exe',['/d','/s','/c',command],{cwd,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(out,label+'.txt'),`cwd: ${cwd}\ncommand: ${command}\nexit: ${r.status}\n${r.stdout??''}${r.stderr??''}`);
  results.push({command,label,exit:r.status,result:r.status===0?'PASS':'FAIL'});
  console.log(`${label}: ${r.status===0?'PASS':'FAIL'}`);
}
const ci=fs.readFileSync(path.join(cwd,'scripts/ci-gate.sh'),'utf8');
for(const match of ci.matchAll(/^node (scripts\/[\w-]+\.mjs)$/gm))
  run(`node ${match[1]}`,path.basename(match[1],'.mjs'));
run('pnpm --filter @ucell/shared test --runInBand','shared-golden-tests');
run('node scripts/test-todo-gate.mjs','test-todo-gate');
const preserved=spawnSync('git',['diff','88bd3d0','--','backend/packages/database/prisma','backend/apps/api/test'],{cwd:root,encoding:'utf8'});
if(preserved.status!==0||preserved.stdout.trim())throw new Error('Schema, fixtures, or E2E sources changed unexpectedly');
fs.writeFileSync(path.join(out,'preservation-check.txt'),'PASS: Prisma schema/migrations/seed and API test tree unchanged from 88bd3d0.\n');
fs.writeFileSync(path.join(out,'gate-results.json'),JSON.stringify(results,null,2)+'\n');
