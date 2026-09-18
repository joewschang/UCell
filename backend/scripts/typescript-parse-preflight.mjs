import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const roots=['apps/api/src','apps/worker/src','packages/database/src'];
function walk(dir){return fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):/\.(ts|tsx)$/.test(e.name)?[path.join(dir,e.name)]:[]):[];}
const parse=(name,text)=>ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS).parseDiagnostics;
// Regression: quotes/brackets inside regular expressions and nested templates are syntax, not delimiters.
assert.equal(parse('valid.ts',String.raw`const cell=(s:string)=>s.replace(/"/g,'""'); const nested = `+'`outer ${`inner ${1}`} end`'+`;`).length,0);
assert.ok(parse('invalid.ts','function broken( { return 1;').length>0);
const failures=[];
for(const file of roots.flatMap(walk))for(const d of parse(file,fs.readFileSync(file,'utf8'))){
 const at=d.file.getLineAndCharacterOfPosition(d.start??0);
 failures.push(`${file}:${at.line+1}:${at.character+1} ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
}
if(failures.length){console.error('TYPESCRIPT_PARSE_PREFLIGHT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1);}
console.log('TYPESCRIPT_PARSE_PREFLIGHT_PASS');
