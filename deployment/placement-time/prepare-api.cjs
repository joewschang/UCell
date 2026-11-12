'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const project=createRequire(path.resolve(__dirname,'../../admin/package.json'));
const ts=project('typescript');
const units=['placement-monitor','placement-time-page'];
function compile(name){
  const file=path.resolve(__dirname,'../../backend/apps/api/src/modules/qualification',name+'.ts');
  return ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
}
function prepare(out,digest){
  digest=digest.replace(/^sha256:/,'');
  assert.match(digest,/^[0-9a-f]{64}$/,'Provide the verified production API image digest');
  fs.mkdirSync(out,{recursive:true});
  for(const name of units)fs.writeFileSync(path.join(out,name+'.js'),compile(name));
  fs.copyFileSync(path.join(__dirname,'install-api.cjs'),path.join(out,'install-api.cjs'));
  fs.writeFileSync(path.join(out,'Dockerfile'),fs.readFileSync(path.join(__dirname,'Dockerfile.api'),'utf8').replace('BASE_DIGEST',digest));
}
module.exports={compile,prepare};
if(require.main===module)prepare(path.resolve(process.argv[2]),process.argv[3]);
