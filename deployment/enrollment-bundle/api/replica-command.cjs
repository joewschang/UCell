'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

// Generate a short-line POSIX shell script for an existing API replica.
// Material comes from the prepared image context and never includes connection data.
const [release, mode, out] = process.argv.slice(2);
if (!release || !out || !['--check','--trial','--apply'].includes(mode)) {
  throw Error('Usage: node replica-command.cjs <prepared-context/release> <--check|--trial|--apply> <shell-file>');
}
const migrations = JSON.parse(fs.readFileSync(path.join(release, 'migrations.json')));
const names = ['migrate.cjs','migrations.json', ...migrations.map(n => 'migrations/' + n + '/migration.sql')];
const payload = Object.fromEntries(names.map(name => [name, fs.readFileSync(path.join(release, name), 'utf8')]));
const compressed = zlib.gzipSync(JSON.stringify(payload));
const hash = crypto.createHash('sha256').update(compressed).digest('hex');
const encoded = compressed.toString('base64').match(/.{1,600}/g);
const restore = [
  'const fs=require("fs"),p=require("path"),c=require("crypto"),z=require("zlib")',
  'const dir=process.argv[1], data=Buffer.from(fs.readFileSync(p.join(dir,"payload"),"ascii"),"base64")',
  'if(c.createHash("sha256").update(data).digest("hex")!=="' + hash + '") throw Error("Release payload hash mismatch")',
  'for(const [name,text] of Object.entries(JSON.parse(z.gunzipSync(data)))){const dest=p.join(dir,name);fs.mkdirSync(p.dirname(dest),{recursive:true});fs.writeFileSync(dest,text)}'
].join(';');
const script = [
  'set -eu',
  'umask 077',
  'bundle_migration_dir=$(mktemp -d)',
  'trap \'rm -rf "$bundle_migration_dir"\' EXIT',
  ...encoded.map(piece => "printf '%s' '" + piece + "' >> \"$bundle_migration_dir/payload\""),
  "node -e '" + restore + "' \"$bundle_migration_dir\"",
  'node "$bundle_migration_dir/migrate.cjs" ' + mode,
  'exit',
].join('\n') + '\n';
fs.writeFileSync(out, script);

