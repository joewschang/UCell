import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import SwaggerParser from '@apidevtools/swagger-parser';
const baseline=process.argv[2];
if(!baseline||!/^[a-f0-9]{40}$/.test(baseline))throw Error('EXPLICIT_BASELINE_COMMIT_REQUIRED');
const old=JSON.parse(execFileSync('git',['show',baseline+':backend/openapi.generated.json'],{encoding:'utf8'}));
const current=JSON.parse(fs.readFileSync('openapi.generated.json','utf8'));
await SwaggerParser.validate(structuredClone(current));
const methods=['get','post','put','patch','delete','head','options'];
const ops=doc=>Object.entries(doc.paths).flatMap(([path,item])=>methods.filter(m=>item[m]).map(method=>({path,method,op:item[method]})));
const oldOps=ops(old),newOps=ops(current),failures=[],changes=[];
const resolve=(doc,x)=>x?.$ref?resolve(doc,x.$ref.slice(2).split('/').reduce((a,k)=>a?.[k.replaceAll('~1','/').replaceAll('~0','~')],doc)):x;
function compatible(a,b,label,request,seen=new Set()){
 a=resolve(old,a);b=resolve(current,b);if(!a)return;
 if(!b){failures.push(label+': schema removed');return;}
 const token=JSON.stringify([a,b]);if(seen.has(token))return;seen.add(token);
 if(a.type&&a.type!==b.type)failures.push(label+': type changed '+a.type+' -> '+b.type);
 if(a.format&&a.format!==b.format)failures.push(label+': format changed');
 if(a.nullable&&!b.nullable&&request)failures.push(label+': input no longer nullable');
 if(!a.nullable&&b.nullable&&!request)failures.push(label+': output newly nullable');
 if(a.enum&&b.enum){const missing=request?a.enum.filter(x=>!b.enum.includes(x)):b.enum.filter(x=>!a.enum.includes(x));if(missing.length)failures.push(label+': enum incompatible');}
 const reqA=a.required??[],reqB=b.required??[];
 if(request?reqB.some(x=>!reqA.includes(x)):reqA.some(x=>!reqB.includes(x)))failures.push(label+': required fields incompatible');
 for(const [key,value]of Object.entries(a.properties??{}))compatible(value,b.properties?.[key],label+'.'+key,request,seen);
 if(a.items)compatible(a.items,b.items,label+'[]',request,seen);
 for(const kind of ['allOf','oneOf','anyOf'])if(a[kind]&&JSON.stringify(a[kind])!==JSON.stringify(b[kind]))changes.push(label+': '+kind+' requires review');
}
for(const {path,method,op:a}of oldOps){
 const b=current.paths[path]?.[method],label=method.toUpperCase()+' '+path;
 if(!b){failures.push(label+': operation removed');continue;}
 if(a.operationId!==b.operationId)failures.push(label+': operationId changed');
 if(JSON.stringify(a.security)!==JSON.stringify(b.security))failures.push(label+': security changed');
 const before=a.parameters??[],after=b.parameters??[];
 for(const p0 of before){const p=resolve(old,p0),n=after.map(x=>resolve(current,x)).find(x=>x.in===p.in&&x.name===p.name);if(!n){failures.push(label+': parameter removed '+p.name);continue;}if(!p.required&&n.required)failures.push(label+': parameter newly required '+p.name);compatible(p.schema,n.schema,label+' parameter '+p.name,true);}
 for(const n0 of after){const n=resolve(current,n0);if(n.required&&!before.map(x=>resolve(old,x)).some(p=>p.in===n.in&&p.name===n.name))failures.push(label+': new required parameter '+n.name);}
 const bodyA=resolve(old,a.requestBody),bodyB=resolve(current,b.requestBody);
 for(const [mime,c]of Object.entries(bodyA?.content??{}))compatible(c.schema,bodyB?.content?.[mime]?.schema,label+' request '+mime,true);
 if(!bodyA?.required&&bodyB?.required)failures.push(label+': request body newly required');
 for(const [status,r0]of Object.entries(a.responses??{})){const r=resolve(old,r0),n=resolve(current,b.responses?.[status]);if(!n){failures.push(label+': response removed '+status);continue;}for(const [mime,c]of Object.entries(r.content??{}))compatible(c.schema,n.content?.[mime]?.schema,label+' response '+status+' '+mime,false);}
}
const report={baseline,validatedWith:'@apidevtools/swagger-parser',baselineOperations:oldOps.length,currentOperations:newOps.length,added:newOps.filter(n=>!oldOps.some(o=>o.path===n.path&&o.method===n.method)).map(n=>n.method.toUpperCase()+' '+n.path),failures,manualReview:changes,limitation:'Structural compatibility only. Pagination token behavior and business semantics require contract tests and review.'};
fs.writeFileSync('../governance/next-generation/evidence/openapi-contract-diff.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(failures.length||changes.length)process.exitCode=1;
