import fs from 'node:fs';import path from 'node:path';
const failures=[];
const required=['src/main.tsx','src/app/App.tsx','src/app/AppShell.tsx','src/lib/api.ts','src/lib/routes.ts','src/styles/main.css'];
for(const f of required) if(!fs.existsSync(f)) failures.push(`missing ${f}`);
function walk(dir){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...walk(p));else if(/\.(ts|tsx)$/.test(p))out.push(p)}return out}
for(const f of walk('src')){
 const s=fs.readFileSync(f,'utf8');
 for(const m of s.matchAll(/from\s+['"](\.[^'"]+)['"]/g)){
  const p=path.resolve(path.dirname(f),m[1]);
  if(![p+'.ts',p+'.tsx',path.join(p,'index.ts'),path.join(p,'index.tsx')].some(fs.existsSync)) failures.push(`${f}: missing import ${m[1]}`);
 }
}
const app=fs.readFileSync('src/app/App.tsx','utf8');
for(const r of ['/people','/applications','/applications/new','/qualifications','/products','/orders','/organization','/subscriptions','/bonuses','/returns','/workflows','/payouts','/system']) if(!app.includes(r)) failures.push(`route ${r} missing`);
const api=fs.readFileSync('src/lib/api.ts','utf8');
if(!api.includes('Authorization')) failures.push('bearer boundary missing');
if(failures.length){console.error('ADMIN_PREFLIGHT_FAIL');failures.forEach(x=>console.error('-',x));process.exit(1)}
console.log('ADMIN_PREFLIGHT_PASS');
