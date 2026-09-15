import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(dir,'../..');const out=path.join(dir,'final');
const results=JSON.parse(fs.readFileSync(path.join(out,'gate-results.json')));
const env={...process.env,DATABASE_URL:'postgresql://ucell:ucell_dev@localhost:5432/ucell?schema=public',NODE_ENV:'test',ADMIN_AUTH_BYPASS:'false',VITE_ENABLE_DEMO_LOGIN:'false'};
function run(area,command,label,overrides={}){
 const start=new Date().toISOString();const cwd=path.join(root,area);
 const r=spawnSync('cmd.exe',['/d','/s','/c',command],{cwd,env:{...env,...overrides},encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
 fs.writeFileSync(path.join(out,'final-'+label+'.txt'),`command: ${command}\nstarted: ${start}\nexit: ${r.status}\n${r.stdout??''}${r.stderr??''}${r.error?.message??''}`);
 results.push({label,phase:'final',cwd,command,start,exitCode:r.status,result:r.status===0?'PASS':'FAIL'});
 fs.writeFileSync(path.join(out,'gate-results.json'),JSON.stringify(results,null,2)+'\n');console.log(`${label}: ${r.status===0?'PASS':'FAIL'}`);
}
if(process.argv.includes('--gate-alignment-only')){
 run('backend','node scripts/admin-operations-preflight.mjs','admin-operations-preflight');
 run('backend','pnpm preflight','ci-gate');
 run('backend','pnpm security:preflight','security-policy-preflight');
 run('backend','pnpm test:todo:gate','test-todo-gate');
 run('backend','pnpm rc:gate','rc-gate');
 run('backend','pnpm release:prep','release-prep');
 run('','"C:\\Program Files\\Git\\bin\\bash.exe" scripts/release-gate.sh','release-gate');
 process.exit(0);
}
run('backend','pnpm --filter @ucell/database exec prisma validate','prisma-validate');
// Generate deferred while the local DEV process holds the Prisma DLL.
run('backend','pnpm --filter @ucell/database exec prisma migrate deploy','prisma-migrate-deploy');
run('backend','pnpm -r build','backend-build');
run('admin','pnpm build','admin-build');
run('backend','pnpm --filter @ucell/api test:e2e --runInBand','api-tests');
run('backend','pnpm --filter @ucell/shared test --runInBand','shared-golden-tests');
run('admin','pnpm test','admin-tests');
run('backend','pnpm test','backend-test-gate');
run('backend','pnpm preflight','ci-gate');
run('backend','pnpm db:golden','db-golden');
run('','node backend/scripts/sa-decision-db-test.mjs','sa-db-regression',{DATABASE_URL:'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public'});
run('backend','pnpm openapi','openapi-export');
run('backend','pnpm openapi:preflight','openapi-preflight');
run('backend','pnpm security:preflight','security-policy-preflight');
run('backend','pnpm security:e2e','security-http-e2e');
run('backend','pnpm rc:gate','rc-gate');
run('backend','pnpm release:prep','release-prep');
run('','"C:\\Program Files\\Git\\bin\\bash.exe" scripts/release-gate.sh','release-gate');
run('backend','pnpm --filter @ucell/api build:admin-dev','full-admin-dev-build');

run('backend','pnpm uat:gate','uat-gate');
