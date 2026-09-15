import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Windows PATH may resolve WSL bash, which cannot run the Windows toolchain.
const gates = new Set(['ci-gate.sh', 'dev-smoke.sh', 'rc-gate.sh', 'release-prep.sh']);
const gate = process.argv[2];
if (!gates.has(gate) || process.argv.length !== 3) {
  console.error('GATE_LAUNCH_FAIL: expected a supported gate filename');
  process.exit(2);
}
let bash = 'bash';
if (process.platform === 'win32') {
  const candidates = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map(root => path.join(root, 'Git', 'bin', 'bash.exe'));
  bash = candidates.find(candidate => fs.existsSync(candidate));
  if (!bash) {
    console.error('GATE_LAUNCH_FAIL: Git for Windows bash.exe is required');
    process.exit(2);
  }
}
const result = spawnSync(bash, [path.join('scripts', gate)], { stdio: 'inherit', env: process.env });
if (result.error) console.error(`GATE_LAUNCH_FAIL: ${result.error.message}`);
process.exit(result.status ?? 1);
