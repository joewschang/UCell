import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..');
const files=execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
const hash=s=>createHash('sha256').update(s).digest('hex');
const manifest=[];const terms=[];const migrations=[];
for(const file of files){
 if(file.startsWith("governance/ux-v2/"))continue;
 if(!/^(backend|member|admin|shared|governance\/sa-decisions)\//.test(file)&&!file.endsWith('.md'))continue;
 const bytes=fs.readFileSync(path.join(root,file));manifest.push({file,bytes:bytes.length,sha256:hash(bytes)});
 if(/\/migrations\/.*\/migration.sql$/.test(file)){
  const sql=bytes.toString('utf8');migrations.push({file,sha256:hash(bytes),statements:sql.split(/\r?\n/).filter(l=>/^\s*(CREATE|ALTER|DROP|UPDATE|INSERT|COMMENT)/i.test(l))});
 }
 if(/\.(tsx?|md|json)$/.test(file)&&!/lock|final\/|node_modules/.test(file)){
  const lines=bytes.toString('utf8').split(/\r?\n/);
  lines.forEach((s,i)=>{if(/\b(PV|BV|GPV|RPV|EPV|45D|45.day|PENDING45D)\b/.test(s))terms.push({file,line:i+1,text:s.length>650?s.slice(0,650)+' [long source line; inspect file]':s});});
 }
}
const api=JSON.parse(fs.readFileSync(path.join(root,'backend/openapi.generated.json'),'utf8'));
const endpoints=Object.entries(api.paths).flatMap(([p,verbs])=>Object.entries(verbs).filter(([v])=>['get','post','put','patch','delete'].includes(v)).map(([method,s])=>({method,path:p,operationId:s.operationId,summary:s.summary,security:s.security})));
const out=import.meta.dirname;
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({baseline:execFileSync('git',['rev-parse',process.argv[2]||'HEAD'],{cwd:root,encoding:'utf8'}).trim(),files:manifest},null,2)+'\n');
fs.writeFileSync(path.join(out,'migration-inventory.json'),JSON.stringify(migrations,null,2)+'\n');
fs.writeFileSync(path.join(out,'terminology-hits.json'),JSON.stringify(terms,null,2)+'\n');
fs.writeFileSync(path.join(out,'openapi-inventory.json'),JSON.stringify(endpoints,null,2)+'\n');
console.log(JSON.stringify({files:manifest.length,migrations:migrations.length,terminologyHits:terms.length,endpoints:endpoints.length}));
