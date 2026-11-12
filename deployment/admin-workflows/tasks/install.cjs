'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { patch } = require('./api.cjs');
const file = '/app/apps/api/dist/operations-daily.cjs';
const source = fs.readFileSync(file, 'utf8');
if (createHash('sha256').update(source).digest('hex') !== '685eb262e03c4f3ebf9525269270f1aeaa46e5c41d37bc2b4bfcde38ed16376a') {
  throw Error('Unexpected daily operations API version');
}
fs.writeFileSync(file, patch(source));
execFileSync(process.execPath, ['--check', file], {stdio:'inherit'});
