'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('./apply.cjs');
const manifest = require('./runtime-delta.json');
const repo = path.resolve(__dirname, '../../..');

function prepare(context) {
  const release = path.join(context, 'release');
  fs.mkdirSync(release, { recursive: true });
  for (const [file, expected] of Object.entries(manifest.source)) {
    const data = fs.readFileSync(path.join(repo, file), 'utf8').replace(/\r\n/g, '\n');
    // The released JS was built before a trailing blank line was removed from a TS file.
    // Keep the image context reproducible and allow that formatting difference only.
    const matches = sha256(data) === expected ||
      (file.endsWith('.ts') && data.endsWith('\n') && sha256(data + '\n') === expected);
    assert(matches, 'Rebuild the API delta to include the source change: ' + file);
  }
  for (const name of ['runtime-delta.json','apply.cjs','smoke.cjs','migrations.json','migrate.cjs']) {
    fs.copyFileSync(path.join(__dirname, name), path.join(release, name));
  }
  for (const name of require('./migrations.json')) {
    const dir = path.join(release, 'migrations', name);
    fs.mkdirSync(dir, { recursive: true });
    const source = path.join(repo, 'backend/packages/database/prisma/migrations', name, 'migration.sql');
    fs.writeFileSync(path.join(dir, 'migration.sql'), fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n'));
  }
  fs.copyFileSync(path.join(__dirname, 'Dockerfile'), path.join(context, 'Dockerfile'));
}
if (require.main === module) {
  if (!process.argv[2]) throw Error('Supply a dedicated image context directory');
  prepare(path.resolve(process.argv[2]));
}
module.exports = { prepare };

