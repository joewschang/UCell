import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {comparisonView,assertSecurityCompatibility,scan,inventory,sha256,canonical,requiredGates,publish,request} from './openapi-governance.mjs';
const make=()=>({openapi:'3.0.0',info:{title:'Synthetic contract',version:'1.0.0'},paths:{'/api/v1/items':{get:{operationId:'items',responses:{200:{description:'ok'}}},post:{operationId:'create',responses:{201:{description:'ok'}}}}},components:{schemas:{Item:{type:'object',properties:{name:{type:'string'}}}}}});
const policy={owner:'ragetech',api:'ucell-api',visibility:'private'};
function fixture(){const bytes=Buffer.from(JSON.stringify(make()));return {bytes,baseline:bytes,commit:'abc',key:'synthetic-test-only',policy,evidence:{executionContext:'github-actions',status:'PASS',commit:'abc',gates:Object.fromEntries(requiredGates.map(x=>[x,'PASS'])),generated:inventory(bytes),baselineSha256:sha256(bytes)}};}
const response=(body,status=200)=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('counts paths, operations and schemas independently',()=>assert.deepEqual(Object.fromEntries(Object.entries(inventory(fixture().bytes)).filter(([k])=>k.endsWith('Count'))),{pathCount:1,operationCount:2,schemaCount:1}));
test('canonical comparison preserves array order',()=>{assert.equal(canonical({b:1,a:2}),canonical({a:2,b:1}));assert.notEqual(canonical([1,2]),canonical([2,1]));});
for(const secret of ['SECRET_NEVER_AI','-----BEGIN PRIVATE KEY-----','Bearer abcdefghijklm','eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijk','password=syntheticcredential','https://user:pass@example.org/']){
 test('rejects forbidden pattern '+secret.slice(0,8),()=>{const s=make();s.info.description=secret;assert.throws(()=>scan(s),/SECRET_SCAN/);});
}
test('rejects external refs and v2 paths',()=>{const s=make();s.components.schemas.Item={$ref:'https://example.org/schema'};assert.throws(()=>scan(s),/EXTERNAL_REF/);const t=make();t.paths['/api/v2/items']=t.paths['/api/v1/items'];assert.throws(()=>scan(t),/V1_PREFIX/);});
test('rejects credential examples resembling numeric examples',()=>{const s=make();s.components.schemas.Item.properties.password={type:'string',example:'123456'};assert.throws(()=>scan(s));});
test('rejects arbitrary examples and exact environment credential',()=>{const s=make();s.components.schemas.Item.example='not-reviewed';assert.throws(()=>scan(s));const t=make();t.info.description='synthetic-test-only';assert.throws(()=>scan(t,['synthetic-test-only']));});
test('failed, missing, stale or tampered gates prevent all network calls',async()=>{for(const mutate of [f=>f.evidence.gates.securityTests='FAIL',f=>delete f.evidence.gates.breakingDiff,f=>f.evidence.commit='other',f=>f.bytes=Buffer.from(JSON.stringify({...make(),info:{title:'changed',version:'1.0.0'}}))]){const f=fixture();mutate(f);await assert.rejects(publish({...f,requestFn:()=>assert.fail('network must not run')}),/PUBLISH_/);}});
test('private readback and distinct generated/published byte hashes',async()=>{const f=fixture(),calls=[];const raw=JSON.stringify(make(),null,2);const r=await publish({...f,requestFn:async(url,o)=>{calls.push([url,o]);return response(url.endsWith('/private')?{private:true}:o.method==='POST'?{}:raw);}});assert.equal(r.status,'PASS');assert.notEqual(r.generated.artifactSha256,r.published.artifactSha256);assert.equal(r.generated.canonicalSha256,r.published.canonicalSha256);assert.ok(calls.find(([u,o])=>o.method==='POST'&&u.includes('isPrivate=true')&&u.includes('force=false')));});
test('reject public remote before upload',async()=>{await assert.rejects(publish({...fixture(),requestFn:async(u,o)=>{assert.notEqual(o.method,'POST');return response({private:false});}}),/NOT_PRIVATE/);});
test('post-upload visibility or mismatch fails without rollback/delete',async()=>{for(const publicAfter of [true,false]){let uploaded=false;await assert.rejects(publish({...fixture(),sleep:async()=>{},requestFn:async(u,o)=>{assert.ok(!['DELETE','PUT'].includes(o.method));if(o.method==='POST'){uploaded=true;return response({});}if(u.endsWith('/private'))return response({private:!(publicAfter&&uploaded)});const d=make();if(uploaded)d.info.title='remote change';return response(d);}}),publicAfter?/NOT_PRIVATE/:/READBACK_MISMATCH/);}});
test('bounded retries and immediate authentication failure',async()=>{let n=0;await request('https://api.swaggerhub.com/test',{}, {fetchFn:async()=>response({},++n<3?503:200),sleep:async()=>{}});assert.equal(n,3);n=0;await assert.rejects(request('https://api.swaggerhub.com/test',{}, {fetchFn:async()=>{n++;return response({},401);},sleep:async()=>{}}),/401/);assert.equal(n,1);n=0;await assert.rejects(request('https://api.swaggerhub.com/test',{}, {fetchFn:async()=>{n++;return response({},429);},sleep:async()=>{}}),/RETRY_EXHAUSTED/);assert.equal(n,4);});
test('reject alternate host and redirects',async()=>{await assert.rejects(request('https://example.org'),/DESTINATION/);await request('https://api.swaggerhub.com/test',{}, {fetchFn:async(u,o)=>{assert.equal(o.redirect,'error');return response({});}});});
test('real pinned diff rejects removals, required inputs and response type changes',{skip:!process.env.OASDIFF_BIN},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ucell-oasdiff-'));
 try{
  const a=make();a.paths['/api/v1/items'].get.responses['200'].content={'application/json':{schema:{type:'string'}}};
  const base=path.join(dir,'base.json');fs.writeFileSync(base,JSON.stringify(a));
  for(const change of [s=>delete s.paths['/api/v1/items'].post,s=>s.paths['/api/v1/items'].get.parameters=[{name:'required',in:'query',required:true,schema:{type:'string'}}],s=>s.paths['/api/v1/items'].get.responses['200'].content['application/json'].schema.type='integer']){
   const b=structuredClone(a);change(b);const rev=path.join(dir,'revision.json');fs.writeFileSync(rev,JSON.stringify(b));const r=spawnSync(process.env.OASDIFF_BIN,['breaking',base,rev,'--fail-on','WARN','--allow-external-refs=false','--config',path.resolve('../governance/swaggerhub/oasdiff.yaml')],{encoding:'utf8'});assert.equal(r.status,1,r.stderr);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('normalization deduplicates only identical header declarations and preserves source',()=>{
 const s=make();s.paths['/api/v1/items'].get.parameters=[{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string'}},{name:'idempotency-key',in:'header',required:true,schema:{type:'string'}}];
 const view=comparisonView(s);assert.equal(view.paths['/api/v1/items'].get.parameters.length,1);assert.equal(s.paths['/api/v1/items'].get.parameters.length,2);
 s.paths['/api/v1/items'].get.parameters[1].required=false;assert.throws(()=>comparisonView(s),/CONFLICTING_HEADER/);
});
test('normalization retains URI paths and non-string constraints',()=>{
 const s=make();s.paths['/api/v1/items/{id}']=s.paths['/api/v1/items'];delete s.paths['/api/v1/items'];
 const v=comparisonView(s);assert.deepEqual(v.paths['/api/v1/items/{id}'].get.parameters,[{name:'id',in:'path',required:true,schema:{type:'string'}}]);
 s.paths['/api/v1/items/{id}'].get.parameters=[{name:'id',in:'path',required:true,schema:{type:'integer'}}];assert.equal(comparisonView(s).paths['/api/v1/items/{id}'].get.parameters[0].schema.type,'integer');
});
test('authentication removal or changed authorization requirements fails',()=>{
 const base=make();base.security=[{bearer:[]}];const next=structuredClone(base);next.paths['/api/v1/items'].get.security=[];assert.throws(()=>assertSecurityCompatibility(base,next),/SECURITY_CONTRACT/);
});

test('reject local-only evidence and missing CI key without network',async()=>{
 const f=fixture();f.evidence.executionContext='local-working-tree';
 await assert.rejects(publish({...f,requestFn:()=>assert.fail('network')}),/GATES_NOT_PASS/);
 const g=fixture();g.key=undefined;await assert.rejects(publish({...g,requestFn:()=>assert.fail('network')}),/CI_SECRET_MISSING/);
});
test('creates absent version with explicit private flag and readback',async()=>{
 let uploaded=false;const r=await publish({...fixture(),requestFn:async(u,o)=>{
  if(o.method==='POST'){assert.ok(u.includes('isPrivate=true'));uploaded=true;return response({});}
  if(!uploaded)return response({},404);
  return response(u.endsWith('/private')?{private:true}:make());
 }});
 assert.equal(r.published.private,true);assert.equal(r.previousArtifactSha256,null);
});
test('upload denial fails visibly and response never leaks credential',async()=>{
 await assert.rejects(publish({...fixture(),requestFn:async(u,o)=>o.method==='POST'?response({},403):response(u.endsWith('/private')?{private:true}:make())}),/UPLOAD_FAILED/);
});
