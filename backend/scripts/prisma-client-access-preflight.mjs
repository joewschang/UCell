import fs from 'node:fs';
import path from 'node:path';

const schema=fs.readFileSync('packages/database/prisma/schema.prisma','utf8');
const models=[...schema.matchAll(/^model\s+([A-Za-z0-9_]+)/gm)].map(m=>m[1]);
const clientNames=new Set(models.map(x=>x[0].toLowerCase()+x.slice(1)));
const ignored=new Set(['getClass','getHandler','switchToHttp']);

function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(p));
    else if(e.isFile() && p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files=[...walk('apps/api/src'),...walk('apps/worker/src')];
const accesses=new Set();
for(const f of files){
  const s=fs.readFileSync(f,'utf8');
  for(const m of s.matchAll(/\b(?:tx|prisma|this\.prisma)\.([A-Za-z][A-Za-z0-9_]*)/g)){
    accesses.add(m[1]);
  }
}
const missing=[...accesses].filter(x=>!clientNames.has(x) && !ignored.has(x)).sort();

if(missing.length){
  console.error('PRISMA_CLIENT_ACCESS_PREFLIGHT_FAIL');
  missing.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('PRISMA_CLIENT_ACCESS_PREFLIGHT_PASS');
