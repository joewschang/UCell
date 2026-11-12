const fs=require('node:fs'),path=require('node:path'),project=require('node:module').createRequire(path.resolve(__dirname,'../../../backend/package.json'));
const ts=project('typescript'),out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
for(const file of ['Dockerfile','install.cjs'])fs.copyFileSync(path.join(__dirname,file),path.join(out,file));
for(const unit of ['contract-renewal','contract-renewal.controller']){
  const source=path.resolve(__dirname,'../../../backend/apps/api/src/modules/member',unit+'.ts');
  const code=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText;
  fs.writeFileSync(path.join(out,unit+'.js'),code);
}
