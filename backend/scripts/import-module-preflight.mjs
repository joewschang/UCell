import fs from 'node:fs';
import path from 'node:path';
const failures=[];

function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(p));
    else if(e.isFile() && p.endsWith('.ts')) out.push(p);
  }
  return out;
}
for(const file of walk('apps')){
  const s=fs.readFileSync(file,'utf8');
  for(const m of s.matchAll(/from\s+['"](\.[^'"]+)['"]/g)){
    const p=path.resolve(path.dirname(file),m[1]);
    const candidates=[p+'.ts',p+'.tsx',path.join(p,'index.ts')];
    if(!candidates.some(fs.existsSync)) failures.push(`${file}: missing import ${m[1]}`);
  }
}
for(const file of walk('apps/api/src').filter(x=>x.endsWith('.module.ts'))){
  const s=fs.readFileSync(file,'utf8');
  const imports=new Set();
  for(const m of s.matchAll(/import\s+\{([^}]+)\}/g))
    m[1].split(',').map(x=>x.trim().split(/\s+as\s+/).pop()).forEach(x=>imports.add(x));
  const mod=s.match(/@Module\(\{([\s\S]*?)\}\)/)?.[1] ?? '';
  for(const k of ['controllers','providers','exports']){
    const list=mod.match(new RegExp(`${k}\\s*:\\s*\\[([^\\]]*)\\]`))?.[1] ?? '';
    for(const x of list.split(',').map(x=>x.trim()).filter(Boolean)){
      if(/^[A-Z]\w+$/.test(x) && !imports.has(x))
        failures.push(`${file}: ${x} used in ${k} but not imported`);
    }
  }
}
if(failures.length){
  console.error('IMPORT_MODULE_PREFLIGHT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('IMPORT_MODULE_PREFLIGHT_PASS');
