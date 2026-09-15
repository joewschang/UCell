import fs from 'node:fs';

const file=process.env.UAT_EXECUTION_FILE??'docs/UAT_EXECUTION_R6.csv';
const text=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').trim();
const lines=text.split(/\r?\n/);

function parse(line){
  const out=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;
    }else if(c===','&&!q){out.push(cur);cur='';}
    else cur+=c;
  }
  out.push(cur);return out;
}
const headers=parse(lines[0]);
const rows=lines.slice(1).filter(Boolean).map(line=>{
  const v=parse(line);return Object.fromEntries(headers.map((h,i)=>[h,v[i]??'']));
});
const p0=rows.filter(r=>r.priority==='P0');
const p1=rows.filter(r=>r.priority==='P1');
const bad0=p0.filter(r=>r.status!=='PASS');
const bad1=p1.filter(r=>r.status!=='PASS');

if(bad0.length){
  console.error('UAT_P0_FAIL');
  bad0.forEach(r=>console.error(`- ${r.id}: ${r.status}`));
  process.exit(1);
}
console.log('UAT_P0_PASS');

if(bad1.length){
  console.error('UAT_P1_FAIL');
  bad1.forEach(r=>console.error(`- ${r.id}: ${r.status}`));
  process.exit(2);
}
console.log('UAT_P1_PASS');
