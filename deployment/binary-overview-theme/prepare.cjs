const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(process.argv[2]);
fs.mkdirSync(output,{recursive:true});
if (fs.readdirSync(output).length) throw Error('Use an empty build directory');
for (const name of ['assemble.cjs','rename.cjs','Dockerfile']) {
  fs.copyFileSync(path.join(__dirname,name),path.join(output,name));
}
fs.copyFileSync(path.join(__dirname,'../../admin/src/features/organization/binary-overview.css'),path.join(output,'binary-overview.css'));
