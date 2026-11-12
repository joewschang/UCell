const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const output = path.resolve(process.argv[2]);
fs.mkdirSync(output,{recursive:true});
if (fs.readdirSync(output).length) throw Error('Use an empty build directory');
for (const file of ['Dockerfile','assemble.cjs']) {
  fs.copyFileSync(path.join(__dirname,file),path.join(output,file));
}
execFileSync(process.execPath,[path.join(__dirname,'compile.cjs'),path.join(output,'component.js')],{stdio:'inherit'});
fs.copyFileSync(path.resolve(__dirname,'../../admin/src/features/organization/sponsor-overview.css'),path.join(output,'sponsor-overview.css'));
