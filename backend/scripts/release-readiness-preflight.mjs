import fs from 'node:fs';
const failures=[];

const required=[
 'docs/SECURITY_THREAT_MATRIX.csv',
 'docs/UAT_SCENARIOS_R6.csv',
 'docs/PRODUCTION_ENV_CHECKLIST.md',
 'docs/RELEASE_CUTOVER_RUNBOOK.md',
 'docs/ROLLBACK_RUNBOOK.md',
 'docs/ADMIN_BOOTSTRAP.md',
 'release/R6_RELEASE_GATE.json'
];
for(const f of required) if(!fs.existsSync(f))failures.push(`missing ${f}`);

const env=fs.readFileSync('.env.example','utf8');
for(const k of ['ENTRA_TENANT_ID','ENTRA_CLIENT_ID','ADMIN_AUTH_BYPASS']){
  if(!env.includes(k+'='))failures.push(`env example missing ${k}`);
}

const gate=JSON.parse(fs.readFileSync('release/R6_RELEASE_GATE.json','utf8'));
for(const x of ['DEPENDENCY_GATE_PASS','SECURITY_E2E_PASS','UAT_P0_PASS','RC_GATE_PASS','SWAGGERHUB_SYNC_PASS']){
  if(!gate.required.includes(x))failures.push(`release gate missing ${x}`);
}

if(failures.length){
 console.error('RELEASE_READINESS_PREFLIGHT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);
}
console.log('RELEASE_READINESS_PREFLIGHT_PASS');
