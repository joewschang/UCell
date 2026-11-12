'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const project = createRequire(path.resolve(__dirname, '../../../backend/package.json'));
const ts = project('typescript');
const source = path.resolve(__dirname, '../../../backend/apps/api/src/modules/organization/sponsor-placement-scope.ts');
const out = path.resolve(process.argv[2]);
fs.mkdirSync(out, { recursive: true });
for (const file of ['Dockerfile', 'install.cjs']) fs.copyFileSync(path.join(__dirname, file), path.join(out, file));
fs.writeFileSync(path.join(out, 'sponsor-placement-scope.js'), ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText);
