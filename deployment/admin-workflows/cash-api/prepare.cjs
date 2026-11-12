'use strict';
const fs=require('node:fs'),path=require('node:path'),src=path.resolve(__dirname,'../../../backend');
const ts=require('node:module').createRequire(path.join(src,'package.json'))('typescript');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
for(const name of ['Dockerfile','install.cjs','finance.cjs','migrate.cjs']) fs.copyFileSync(path.join(__dirname,name),path.join(out,name));
fs.copyFileSync(path.join(src,'packages/database/prisma/migrations/20261113010000_formal_payout_method/migration.sql'),path.join(out,'migration.sql'));
for(const name of ['formal-payout-method','formal-payout-method.controller']){
 const s=fs.readFileSync(path.join(src,'apps/api/src/modules/member',name+'.ts'),'utf8');
 fs.writeFileSync(path.join(out,name+'.js'),ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText);
}
