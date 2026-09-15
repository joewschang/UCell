import fs from 'node:fs';
import path from 'node:path';

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory() && !['node_modules','dist','.git'].includes(e.name)) out.push(...walk(p));
    else if(e.isFile() && /\.(ts|tsx|js|mjs)$/.test(p)) out.push(p);
  }
  return out;
}
const candidates=[...walk('apps'),...walk('packages')].filter(f=>/test|spec/i.test(f));
const offenders=[];
for(const file of candidates){
  const text=fs.readFileSync(file,'utf8');
  const count=(text.match(/\b(?:it|test)\.todo\s*\(/g)||[]).length;
  if(count) offenders.push({file,count});
}
const total=offenders.reduce((s,x)=>s+x.count,0);
if(total){
  console.error(`TEST_TODO_GATE_FAIL: ${total} unresolved executable test placeholders`);
  offenders.forEach(x=>console.error(`- ${x.file}: ${x.count}`));
  process.exit(1);
}
console.log('TEST_TODO_GATE_PASS');
