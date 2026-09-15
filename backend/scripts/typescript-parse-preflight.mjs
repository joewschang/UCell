
import fs from 'node:fs';
import path from 'node:path';

const roots=['apps/api/src','apps/worker/src','packages/database/src'];
const failures=[];

function walk(dir){
  if(!fs.existsSync(dir))return[];
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())out.push(...walk(p));
    else if(/\.(ts|tsx)$/.test(p))out.push(p);
  }
  return out;
}

// Lightweight structural parser without dependency on project node_modules.
// Checks balanced (), {}, [], strings/comments approximately; full TS compile remains RC Gate.
for(const file of roots.flatMap(walk)){
  const s=fs.readFileSync(file,'utf8');
  let stack=[], quote=null, esc=false, line=false, block=false;
  for(let i=0;i<s.length;i++){
    const c=s[i],n=s[i+1];
    if(line){if(c==='\n')line=false;continue}
    if(block){if(c==='*'&&n==='/'){block=false;i++}continue}
    if(quote){
      if(esc){esc=false;continue}
      if(c==='\\'){esc=true;continue}
      if(c===quote)quote=null;
      continue;
    }
    if(c==='/'&&n==='/'){line=true;i++;continue}
    if(c==='/'&&n==='*'){block=true;i++;continue}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue}
    if('({['.includes(c))stack.push(c);
    if(')}]'.includes(c)){
      const expect={')':'(', '}':'{', ']':'['}[c];
      if(stack.pop()!==expect){failures.push(`${file}: unbalanced ${c}`);break}
    }
  }
  if(stack.length)failures.push(`${file}: unclosed delimiters`);
}
if(failures.length){
  console.error('TYPESCRIPT_PARSE_PREFLIGHT_FAIL');
  failures.forEach(x=>console.error('-',x));
  process.exit(1);
}
console.log('TYPESCRIPT_PARSE_PREFLIGHT_PASS');
