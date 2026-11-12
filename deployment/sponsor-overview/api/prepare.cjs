const fs=require('node:fs');
const path=require('node:path');
const target=path.resolve(process.argv[2]);
fs.mkdirSync(target,{recursive:true});
if(fs.readdirSync(target).length) throw Error('Use an empty API build directory');
const api=path.resolve(__dirname,'../../../backend/apps/api');
const ts=require(require.resolve('typescript',{paths:[api]}));
const controller=fs.readFileSync(path.join(api,'src/modules/admin-observability/sponsor-map.controller.ts'),'utf8');
const compiled=ts.transpileModule(controller,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,
}});
fs.writeFileSync(path.join(target,'sponsor-map.controller.js'),compiled.outputText);
for(const name of ['Dockerfile','install.cjs','verify.cjs'])fs.copyFileSync(path.join(__dirname,name),path.join(target,name));
