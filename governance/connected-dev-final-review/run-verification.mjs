import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(scriptDir, 'final');
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(scriptDir, '../..');
const env = { ...process.env, DATABASE_URL: 'postgresql://ucell:ucell_dev@localhost:5432/ucell?schema=public',
  NODE_ENV: 'test', ADMIN_AUTH_BYPASS: 'false', VITE_ENABLE_DEMO_LOGIN: 'false' };
const shellOnly = process.argv.includes('--shell-gates-only');
const results = shellOnly
  ? JSON.parse(fs.readFileSync(path.join(out, 'gate-results.json'), 'utf8'))
    .filter(row => !['ci-gate', 'release-gate', 'rc-gate', 'shell-syntax'].includes(row.label))
  : [];
function run(area, command, label) {
  const cwd = path.join(root, area);
  const start = new Date().toISOString();
  const bashPrefix = '"C:\\Program Files\\Git\\bin\\bash.exe" ';
  const executable = command.startsWith(bashPrefix) ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'cmd.exe';
  const args = command.startsWith(bashPrefix)
    ? command.slice(bashPrefix.length).split(' ')
    : ['/d', '/s', '/c', command];
  const result = spawnSync(executable, args, {
    cwd, env, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
  });
  const output = (result.stdout ?? '') + (result.stderr ?? '') + (result.error?.message ?? '');
  fs.writeFileSync(path.join(out, `${label}.txt`), `cwd: ${cwd}\ncommand: ${command}\nstarted: ${start}\nexit: ${result.status}\n${output}`);
  results.push({ label, cwd, command, start, exitCode: result.status, signal: result.signal,
    result: result.status === 0 ? 'PASS' : 'FAIL' });
  fs.writeFileSync(path.join(out, 'gate-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(`${label}: ${result.status === 0 ? 'PASS' : 'FAIL'} (exit ${result.status})`);
}
if (shellOnly) {
  run('backend', '"C:\\Program Files\\Git\\bin\\bash.exe" -n scripts/rc-gate.sh', 'shell-syntax');
  run('backend', '"C:\\Program Files\\Git\\bin\\bash.exe" scripts/ci-gate.sh', 'ci-gate');
  run('backend', '"C:\\Program Files\\Git\\bin\\bash.exe" scripts/rc-gate.sh', 'rc-gate');
  run('', '"C:\\Program Files\\Git\\bin\\bash.exe" scripts/release-gate.sh', 'release-gate');
  process.exit(0);
}
run('', 'node --version', 'node-version');
run('', 'pnpm --version', 'pnpm-version');
run('', 'git status --short --branch', 'git-status');
run('backend', 'pnpm install --frozen-lockfile', 'backend-install');
run('admin', 'pnpm install --frozen-lockfile', 'admin-install');
run('backend', 'pnpm peers check', 'backend-peers');
const ci = fs.readFileSync(path.join(root, 'backend/scripts/ci-gate.sh'), 'utf8');
for (const match of ci.matchAll(/^node (scripts\/[\w-]+\.mjs)$/gm)) {
  run('backend', `node ${match[1]}`, path.basename(match[1], '.mjs'));
}
run('admin', 'pnpm preflight', 'admin-preflight');
run('admin', 'pnpm selfaudit', 'admin-selfaudit');
run('backend', 'pnpm --filter @ucell/database exec prisma validate', 'prisma-validate');
run('backend', 'pnpm --filter @ucell/database exec prisma generate', 'prisma-generate');
run('backend', 'pnpm --filter @ucell/database exec prisma migrate deploy', 'prisma-migrate-deploy');
run('backend', 'pnpm -r build', 'backend-build');
run('admin', 'pnpm build', 'admin-build');
run('backend', 'pnpm --filter @ucell/shared test --runInBand', 'shared-golden-tests');
run('backend', 'pnpm --filter @ucell/api test:e2e --runInBand', 'api-tests');
run('backend', 'pnpm test', 'backend-test-gate');
run('admin', 'pnpm test', 'admin-tests');
run('backend', 'node scripts/test-todo-gate.mjs', 'test-todo-gate');
run('backend', 'pnpm db:golden', 'db-golden');
run('backend', 'pnpm openapi', 'openapi-export');
run('backend', 'node scripts/openapi-preflight.mjs', 'openapi-preflight');
run('backend', 'node scripts/security-http-e2e.mjs', 'security-http-e2e');
run('backend', 'node scripts/http-smoke.mjs', 'http-smoke');
run('backend', 'pnpm uat:gate', 'uat-gate');
run('backend', 'pnpm audit --json', 'backend-dependency-audit');
run('admin', 'pnpm audit --json', 'admin-dependency-audit');
run('backend', '"C:\\Program Files\\Git\\bin\\bash.exe" scripts/ci-gate.sh', 'ci-gate');
run('backend', '"C:\\Program Files\\Git\\bin\\bash.exe" scripts/rc-gate.sh', 'rc-gate');
run('', '"C:\\Program Files\\Git\\bin\\bash.exe" scripts/release-gate.sh', 'release-gate');
run('backend', 'pnpm preflight', 'windows-preflight-entrypoint');
run('backend', 'pnpm dev:smoke', 'windows-dev-smoke-entrypoint');
run('backend', 'pnpm rc:gate', 'windows-rc-entrypoint');
run('backend', 'pnpm release:prep', 'windows-release-prep-entrypoint');

const rows = [];
const testDir = path.join(root, 'backend/apps/api/test');
for (const name of fs.readdirSync(testDir).sort()) {
  if (!name.endsWith('.ts')) continue;
  const lines = fs.readFileSync(path.join(testDir, name), 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/\b(?:it|test)\.todo\s*\('(.+)'\)/);
    if (match) rows.push({ id: `TODO-${String(rows.length + 1).padStart(3, '0')}`,
      file: `backend/apps/api/test/${name}`, line: index + 1, title: match[1],
      category: 'Test implementation', domain: name.replace('.e2e-spec.ts', ''),
      status: 'TODO / NOT EXECUTED', specificationReview: 'Required before implementation; no rule inferred from title alone' });
  });
}
fs.writeFileSync(path.join(out, 'todo-inventory.json'), JSON.stringify(rows, null, 2) + '\n');
const keys = Object.keys(rows[0]);
const csv = [keys, ...rows.map(row => keys.map(key => row[key]))]
  .map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\n');
fs.writeFileSync(path.join(out, 'todo-inventory.csv'), csv + '\n');
console.log(`TODO inventory: ${rows.length}`);
