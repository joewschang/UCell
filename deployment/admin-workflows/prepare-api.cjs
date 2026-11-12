'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const output = path.resolve(process.argv[2]);
execFileSync(process.execPath, [path.join(__dirname, 'cash-api/prepare.cjs'), output], {stdio:'inherit'});
const files = ['deployment/admin-workflows/tasks/install.cjs','deployment/admin-workflows/tasks/api.cjs','backend/apps/api/src/daily-task-routes.cjs'];
const root = path.resolve(__dirname, '../..');
for (const file of files) {
  const target = path.join(output, 'daily-tasks', file);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.copyFileSync(path.join(root, file), target);
}
fs.appendFileSync(path.join(output, 'Dockerfile'), '\nCOPY daily-tasks/ /tmp/admin-daily-tasks/\nRUN node /tmp/admin-daily-tasks/deployment/admin-workflows/tasks/install.cjs && rm -r /tmp/admin-daily-tasks\n');
