import { spawnSync } from 'node:child_process';

// An inherited NODE_ENV=development must not enable demo login in build output.
const env = { ...process.env, NODE_ENV: 'production', VITE_ENABLE_DEMO_LOGIN: 'false', VITE_ADMIN_DEV_READ_ONLY: 'false', VITE_ADMIN_DEV_FULL_ACCESS: 'false' };
for (const command of ['pnpm exec tsc -b', 'pnpm exec vite build']) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', command], { env, stdio: 'inherit' })
    : spawnSync('pnpm', command.split(' ').slice(1), { env, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
