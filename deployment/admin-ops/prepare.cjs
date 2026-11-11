const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const target=path.resolve(process.argv[2]);
if(fs.existsSync(target) && fs.readdirSync(target).length) throw Error('Use a new build context directory');
fs.mkdirSync(target,{recursive:true});
const assets=[
  'Dockerfile','assemble.cjs','routes.cjs','workbench/workbench.js','workbench/patch.cjs','workbench/workbench.css',
  'navigation/patch.cjs','report/patch.cjs',
  'control/patch-payment.cjs','control/control.js','control/control.css'
];
for(const name of assets){
  const dest=path.join(target,name);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(path.join(__dirname,name),dest);
}
for(const style of ['navigation.css','contrast.css']){
  fs.copyFileSync(path.resolve(__dirname,'../../admin/src/app',style),path.join(target,'navigation',style));
}
execFileSync(process.execPath,[path.join(__dirname,'navigation/compile.cjs'),path.join(target,'navigation/directory.js')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(__dirname,'report/compile.cjs'),path.join(target,'report/component.js')],{stdio:'inherit'});
fs.mkdirSync(path.join(target,'grid'));
fs.copyFileSync(path.resolve(__dirname,'../../admin/src/components/admin-data-grid.css'),path.join(target,'grid/grid.css'));
execFileSync(process.execPath,[path.join(__dirname,'grid/compile.cjs'),path.join(target,'grid/component.js')],{stdio:'inherit'});
