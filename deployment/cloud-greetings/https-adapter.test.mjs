import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createHttpsTransport,encodeClientCredentials} from './https-adapter.mjs';
import {URL,KEY,TOKEN,prepared,result} from './test-support/fixtures.mjs';
const options=()=>({method:'POST',redirect:'error',signal:new AbortController().signal,headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json','Idempotency-Key':KEY},body:prepared().body});
function mock(behavior) {
  const calls=[];
  const request=(url,opts,callback)=>{
    const req=new EventEmitter();req.destroy=()=>{req.destroyed=true;};
    req.end=body=>{calls.push({url,opts,body,req});queueMicrotask(()=>behavior({req,callback,opts}));};return req;
  };
  return {calls,request};
}
function response(callback,{status=200,headers={'content-type':'application/json'},body=JSON.stringify(result),complete=true}={}) {
  const res=new PassThrough();res.statusCode=status;res.headers=headers;res.complete=complete;callback(res);if(!res.destroyed)res.end(body);return res;
}
const adapter=(request,extra={})=>createHttpsTransport({publishEndpoint:URL,proxyEnv:{},request,...extra});
test('HTTPS adapter pins request, reconstructs headers, verifies TLS and passes proxy configuration',async()=>{
  const m=mock(({callback})=>response(callback));const proxyEnv={HTTPS_PROXY:'http://isolated-proxy.invalid:8080'};
  const r=await adapter(m.request,{proxyEnv})(URL,options());assert.deepEqual(await r.json(),result);
  const call=m.calls[0];assert.equal(call.url,URL);assert.equal(call.body,prepared().body);assert.equal(call.opts.rejectUnauthorized,true);assert.equal(call.opts.minVersion,'TLSv1.2');assert.equal(call.opts.maxHeaderSize,8192);
  assert.equal(call.opts.agent.options.proxyEnv,proxyEnv);assert.equal(call.opts.headers['Content-Length'],Buffer.byteLength(call.body));assert.equal(call.opts.headers['Accept-Encoding'],'identity');assert.equal(call.req.destroyed,true);
});
test('host/path/port/header/method/body restrictions reject before network',async()=>{
  let called=false;const send=adapter(()=>{called=true;throw Error(TOKEN);});
  for(const url of [URL.replace('publisher','other'),URL+'?x=1',URL.replace('https:','http:'),URL.replace('.invalid','.invalid:444'),URL+'/'])await assert.rejects(send(url,options()),/HTTPS_REQUEST_INVALID/);
  for(const patch of [{method:'GET'},{redirect:'follow'},{body:'x'.repeat(10_670_001)},{headers:{...options().headers,Host:'evil.invalid'}},{headers:{...options().headers,Authorization:'Bearer '+TOKEN+'\r\nX: bad'}}])await assert.rejects(send(URL,{...options(),...patch}),/HTTPS_REQUEST_INVALID/);
  assert.equal(called,false);
});
test('all redirects returned once without following Location or retaining sensitive body',async()=>{
  for(const status of [301,302,303,307,308,401,403,409,503]){
    const m=mock(({callback})=>response(callback,{status,headers:{location:'https://evil.invalid'},body:TOKEN}));
    const r=await adapter(m.request)(URL,options());assert.equal(r.status,status);assert.equal(await r.text(),'');assert.equal(m.calls.length,1);
  }
});
test('bounded response, compression, malformed length, truncation and content type fail closed',async()=>{
  for(const config of [{body:'x'.repeat(4097)},{headers:{'content-type':'application/json','content-length':'4097'}},{headers:{'content-type':'application/json','content-length':'invalid'}},{headers:{'content-type':'application/json','content-length':'2'}},{headers:{'content-type':'application/json','content-encoding':'gzip'}},{headers:{'content-type':'text/html'},body:TOKEN},{complete:false}]){
    const m=mock(({callback})=>response(callback,config));await assert.rejects(adapter(m.request)(URL,options()),/^Error: HTTPS_RESPONSE_(INVALID|TOO_LARGE|FAILED)$/);assert.equal(m.calls[0].req.destroyed,true);
  }
});
test('request errors and sync throws are sanitized; total timeout destroys request',async()=>{
  const m=mock(({req})=>req.emit('error',Error(TOKEN)));await assert.rejects(adapter(m.request)(URL,options()),/^Error: HTTPS_FAILED$/);
  await assert.rejects(adapter(()=>{throw Error(TOKEN);})(URL,options()),/^Error: HTTPS_FAILED$/);
  const stalled=mock(()=>{});await assert.rejects(adapter(stalled.request,{timeoutMs:10})(URL,options()),/^Error: HTTPS_TIMEOUT$/);assert.equal(stalled.calls[0].req.destroyed,true);
});
test('pre-abort and mid-stream cancellation; response errors are sanitized',async()=>{
  const controller=new AbortController();controller.abort();const m=mock(()=>{});await assert.rejects(adapter(m.request)(URL,{...options(),signal:controller.signal}),/HTTPS_CANCELLED/);assert.equal(m.calls.length,0);
  const active=new AbortController();const stream=mock(({callback})=>{const res=new PassThrough();res.statusCode=200;res.headers={'content-type':'application/json'};callback(res);active.abort();});
  await assert.rejects(adapter(stream.request)(URL,{...options(),signal:active.signal}),/HTTPS_CANCELLED/);
  const broken=mock(({callback})=>{const res=new PassThrough();res.statusCode=200;res.headers={'content-type':'application/json'};callback(res);res.emit('error',Error(TOKEN));});await assert.rejects(adapter(broken.request)(URL,options()),/^Error: HTTPS_RESPONSE_FAILED$/);
});
test('fake sentinel form roundtrip proves encoding only, never proxy substitution',()=>{
  const placeholder='FAKE_SENTINEL_+ /&=%漢字';const encoded=encodeClientCredentials({tenantId:KEY,clientId:KEY,audience:KEY,placeholder});
  assert.equal(new URLSearchParams(encoded.body).get('client_secret'),placeholder);assert.ok(encoded.body.includes('%2B'));assert.ok(encoded.body.includes('%26'));assert.equal(encoded.url,`https://login.microsoftonline.com/${KEY}/oauth2/v2.0/token`);assert.equal(new URLSearchParams(encoded.body).get('scope'),`api://${KEY}/.default`);
});
test('adapter does not write console logs',async()=>{
  const seen=[];const names=['log','error','warn','info','debug'];const old=names.map(n=>console[n]);names.forEach(n=>{console[n]=(...v)=>seen.push(v);});
  try{const m=mock(({req})=>req.emit('error',Error(TOKEN)));await assert.rejects(adapter(m.request)(URL,options()));}finally{names.forEach((n,i)=>{console[n]=old[i];});}assert.deepEqual(seen,[]);
});
