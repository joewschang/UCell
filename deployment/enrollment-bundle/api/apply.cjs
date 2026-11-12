'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function apply(dist, manifest) {
  const prepared = [];
  for (const entry of manifest.files) {
    assert(/^(?:[a-z0-9-]+\/)*[a-z0-9.-]+\.js$/.test(entry.file), entry.file);
    const file = path.join(dist, entry.file);
    const existing = fs.existsSync(file) ? fs.readFileSync(file) : null;
    assert.equal(existing && sha256(existing), entry.before, 'Unrecognized API image file: ' + entry.file);
    const lines = (existing?.toString('utf8') ?? '').replace(/\r\n/g, '\n').split('\n');
    for (const [start, deleted, added] of entry.changes.slice().reverse()) {
      lines.splice(start, deleted, ...added);
    }
    const result = Buffer.from(lines.join('\n'));
    assert.equal(sha256(result), entry.after, 'Invalid release content: ' + entry.file);
    prepared.push([file, result]);
  }
  for (const [file, result] of prepared) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, result);
  }
  return prepared.length;
}
if (require.main === module) {
  const changed = apply(process.argv[2] || '/app/apps/api/dist', require('./runtime-delta.json'));
  console.log('Verified and applied ' + changed + ' exact API file changes');
}
module.exports = { apply, sha256 };

