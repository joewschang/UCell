import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const out = path.join(dir, 'final');
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
};
const legacy = git('show', 'df13581:backend/scripts/golden-domain-test.mjs');
fs.writeFileSync(path.join(dir, 'golden-domain-test.legacy.mjs.txt'), legacy);
const hash = text => createHash('sha256').update(text).digest('hex');
fs.writeFileSync(path.join(dir, 'legacy-test-drift.json'), JSON.stringify({
  classification: 'Legacy Test Drift', originalCommit: 'df13581',
  originalSource: 'backend/scripts/golden-domain-test.mjs', originalSHA256: hash(legacy),
  evidence: 'golden-domain-test.legacy.mjs.txt',
  drift: ['EPV amount * 0.70 / EPV(2400)=1680', 'Pools 42/36/12/5/5'],
  ssotReferences: ['../local-ssot-review/source-manifest.json', 'S02 P0035/P0422/P0567', 'S06 P0026'],
  history: 'd3e0764 corrected only the test to existing shared constants before the latest instruction; production monetary rules were not modified. The original is preserved here and in Git history. No further semantic changes in this phase.',
}, null, 2) + '\n');
const preservedPaths = ['backend/packages/database/prisma', 'backend/packages/shared/src/r1-0b-golden.ts', ...JSON.parse(fs.readFileSync(path.join(out, 'todo-inventory.json'))).map(r => r.file)];
const preservedDiff = git('diff', 'df13581', '--', ...new Set(preservedPaths));
if (preservedDiff.trim()) throw new Error('Frozen schema/rules/original TODO preservation failed');
fs.writeFileSync(path.join(out, 'preservation-check.txt'), 'PASS: Prisma schema/migrations/seed, shared frozen constants, all 13 original TODO files unchanged versus df13581.\n');
const results = JSON.parse(fs.readFileSync(path.join(out, 'gate-results.json')));
for (const command of ['pnpm preflight', 'pnpm dev:smoke', 'pnpm rc:gate', 'pnpm release:prep']) {
  const label = 'entrypoint-' + command.split(' ')[1].replaceAll(':', '-');
  const start = new Date().toISOString();
  const r = spawnSync('cmd.exe', ['/d', '/s', '/c', command], { cwd: path.join(root, 'backend'),
    env: { ...process.env, DATABASE_URL: 'postgresql://ucell:ucell_dev@localhost:5432/ucell?schema=public' },
    encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(out, label + '.txt'), `command: ${command}\nstarted: ${start}\nexit: ${r.status}\n${r.stdout ?? ''}${r.stderr ?? ''}${r.error?.message ?? ''}`);
  results.push({ label, command, cwd: path.join(root, 'backend'), start, exitCode: r.status, result: r.status === 0 ? 'PASS' : 'FAIL' });
  console.log(label + ': ' + (r.status === 0 ? 'PASS' : 'FAIL'));
}
fs.writeFileSync(path.join(out, 'gate-results.json'), JSON.stringify(results, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'PASS-FAIL-MATRIX.md'), '| Gate | Result | Exit | Command |\n| --- | --- | --- | --- |\n' + results.map(r => `| ${r.label} | ${r.result} | ${r.exitCode} | ${r.command} |`).join('\n') + '\n');
fs.writeFileSync(path.join(out, 'source-diff-stat.txt'), git('diff', 'df13581', '--stat', '--', 'backend', 'admin', '.github', '.gitignore', 'scripts'));
fs.writeFileSync(path.join(out, 'current-stage-diff.txt'), git('diff', 'd3e0764', '--', 'backend'));
console.log('Preservation PASS; matrix and legacy evidence written');
