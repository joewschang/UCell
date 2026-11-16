import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {prepareRequest, createUploader, validatePng} from './uploader.mjs';
const NOW = new Date('2026-11-16T23:00:00Z'), key = '11111111-1111-4111-8111-111111111111';
const url = 'https://publisher.example.invalid/api/v1/integrations/dot/daily-greetings/publish';
const secret = 'SYNTHETIC_TOKEN_NEVER_REAL';
function chunk(type, bytes) {
  const result = Buffer.alloc(bytes.length + 12); result.writeUInt32BE(bytes.length); result.write(type, 4); bytes.copy(result, 8);
  let crc = 0xffffffff; for (const b of result.subarray(4, -4)) { crc ^= b; for (let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
  result.writeUInt32BE((crc^0xffffffff)>>>0,result.length-4); return result;
}
function png({width=1024, depth=8, color=2, extra=Buffer.alloc(0), pixels=Buffer.alloc(1024*3073)}={}) {
  const hdr=Buffer.alloc(13);hdr.writeUInt32BE(width);hdr.writeUInt32BE(1024,4);hdr[8]=depth;hdr[9]=color;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',hdr),extra,chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
const image=png();
const payload = {date:'2026-11-17',title:'早安',message:'願你平安喜樂',contentBase64:image.toString('base64')};
const prepared = () => prepareRequest(payload,key,NOW);
const ok = (change={}) => Response.json({date:payload.date,id:key,status:'PUBLISHED',...change});
function setup(transport=async()=>ok(), other={}) { return createUploader({publishEndpoint:url,tokenProvider:async()=>secret,transport,now:()=>NOW,sleep:async()=>{},...other}); }

test('strict payload shape, Unicode copy, UUID and Taipei release boundary',()=>{
  assert.equal(JSON.parse(prepared().body).date,payload.date);
  for(const change of [{url:'https://evil.invalid'},{title:''},{title:' early'},{title:'123456789'},{message:'<b>早安</b>'},{message:'https://x.invalid'},{message:'a\u200bb'},{contentBase64:'!!!'},{date:'2026-11-16'},{date:'2026-11-18'},{date:'2026-02-30'}]) assert.throws(()=>prepareRequest({...payload,...change},key,NOW));
  assert.throws(()=>prepareRequest(payload,'not-uuid',NOW));
  assert.throws(()=>prepareRequest(payload,key,new Date('2026-11-16T22:59:59Z')));
  assert.doesNotThrow(()=>prepareRequest(payload,key,new Date('2026-11-17T22:59:59Z')));
  assert.throws(()=>prepareRequest(payload,key,new Date('2026-11-17T23:00:00Z')));
});
test('PNG CRC, bounds, RGB/RGBA, structure, non-animation and bounded inflate',()=>{
  validatePng(image);validatePng(png({color:6,pixels:Buffer.alloc(1024*4097)}));
  const corrupt=Buffer.from(image);corrupt[40]^=1;
  for(const bad of [corrupt,image.subarray(0,-1),Buffer.concat([image,Buffer.from('junk')]),Buffer.alloc(8_000_001),png({width:1023}),png({depth:16}),png({color:3}),png({extra:chunk('acTL',Buffer.alloc(8))}),png({pixels:Buffer.alloc(1)}),png({pixels:Buffer.alloc(1024*3073+1)}),png({pixels:Buffer.alloc(1024*3073,5)})]) assert.throws(()=>validatePng(bad),/PNG_INVALID/);
});
test('explicit HTTPS endpoint only; no default adapter or implicit endpoint',()=>{
  for(const endpoint of [undefined,'http://publisher.example.invalid'+new URL(url).pathname,url+'?a=1',url+'#x',url+'/',url.replace('https://','https://user:pass@'),url.replace('.invalid','.invalid:444'),url.replace('publisher.example.invalid','127.0.0.1'),url.replace('publisher.example.invalid','localhost'),url.replace('/api/','/%61pi/'),url.replace('https://','https://\n')]) assert.throws(()=>setup(undefined,{publishEndpoint:endpoint}),/ENDPOINT_INVALID/);
  assert.throws(()=>createUploader({publishEndpoint:url}),/ADAPTER_REQUIRED/);
});
test('transport contract, sanitized response and immutable same-request retries',async()=>{
  const calls=[],waits=[];let count=0;
  const req={...prepared()};
  const upload=setup(async(u,options)=>{calls.push({u,...options});if(++count===1){req.body='changed';throw Error(secret);}if(count===2)return new Response(secret,{status:503});return ok({status:'ALREADY_PUBLISHED',debug:secret});},{sleep:async ms=>waits.push(ms)});
  const result=await upload(req);assert.deepEqual(result,{date:payload.date,id:key,status:'ALREADY_PUBLISHED'});
  assert.deepEqual(waits,[1000,2000]);assert.equal(calls.length,3);
  for(const c of calls){assert.equal(c.u,url);assert.equal(c.method,'POST');assert.equal(c.redirect,'error');assert.equal(c.body,prepared().body);assert.equal(c.headers['Idempotency-Key'],key);assert.equal(c.headers.Authorization,'Bearer '+secret);assert.ok(c.signal instanceof AbortSignal);}
});
test('retry exhaustion is uncertainty and never silently changes key',async()=>{
  let count=0;await assert.rejects(setup(async()=>{count++;throw Error(secret);})(prepared()),/^Error: PUBLISH_UNCERTAIN_RETRY_SAME_REQUEST$/);assert.equal(count,3);
});
test('permanent HTTP failures and redirects never retry; no body/error/token leaks',async()=>{
  for(const status of [301,302,307,308,400,401,403,404,409,500]){
    let count=0;await assert.rejects(setup(async()=>{count++;return new Response(secret,{status});})(prepared()),new RegExp(status===409?'^Error: PUBLISH_CONFLICT$':'^Error: PUBLISH_REJECTED$'));assert.equal(count,1);
  }
  await assert.rejects(setup(undefined,{tokenProvider:async()=>{throw Error(secret);}})(prepared()),/^Error: AUTH_UNAVAILABLE$/);
  await assert.rejects(setup(undefined,{tokenProvider:async()=>secret+'\r\nInjected: true'})(prepared()),/^Error: AUTH_UNAVAILABLE$/);
});
test('rejects invalid/bounded success responses and unexpected destinations',async()=>{
  for(const response of [ok({date:'2026-11-18'}),ok({id:'not-uuid'}),ok({status:'OK'}),new Response(secret),new Response('{',{headers:{'content-type':'application/json'}}),new Response('x'.repeat(4097),{headers:{'content-type':'application/json'}})]) await assert.rejects(setup(async()=>response)(prepared()),/^Error: RESPONSE_INVALID$/);
  const redirected=ok();Object.defineProperty(redirected,'redirected',{value:true});await assert.rejects(setup(async()=>redirected)(prepared()),/RESPONSE_INVALID/);
  const wrongUrl=ok();Object.defineProperty(wrongUrl,'url',{value:'https://evil.invalid'});await assert.rejects(setup(async()=>wrongUrl)(prepared()),/RESPONSE_INVALID/);
});
test('date is revalidated after token acquisition and between retries',async()=>{
  let current=NOW,calls=0;
  await assert.rejects(setup(async()=>{calls++;return ok();},{now:()=>current,tokenProvider:async()=>{current=new Date('2026-11-17T23:00:00Z');return secret;}})(prepared()),/DATE_INVALID/);assert.equal(calls,0);
  current=NOW;
  await assert.rejects(setup(async()=>{calls++;return new Response('',{status:503});},{now:()=>current,sleep:async()=>{current=new Date('2026-11-17T23:00:00Z');}})(prepared()),/DATE_INVALID/);assert.equal(calls,1);
});
test('uploader emits no logs on sensitive failures',async()=>{
  const output=[];const methods=['log','warn','error','info','debug'];const saved=methods.map(k=>console[k]);
  methods.forEach(k=>{console[k]=(...args)=>output.push(args);});
  try{await assert.rejects(setup(async()=>new Response(secret,{status:403}))(prepared()),/PUBLISH_REJECTED/);}finally{methods.forEach((k,i)=>{console[k]=saved[i];});}
  assert.deepEqual(output,[]);
});
test('all configured transient statuses retry identically and request parsing fails closed',async()=>{
  for(const status of [429,502,503,504]){
    let calls=0;
    await setup(async(_url,opts)=>{assert.equal(opts.body,prepared().body);assert.equal(opts.headers['Idempotency-Key'],key);return ++calls===1?new Response(secret,{status}):ok();})(prepared());
    assert.equal(calls,2);
  }
  for(const req of [null,{body:'{',idempotencyKey:key},{body:prepared().body,idempotencyKey:'bad'},{body:'x'.repeat(10_670_001),idempotencyKey:key}]) await assert.rejects(setup()(req));
});
test('body stream exceptions are sanitized and aborted provider never reaches transport',async()=>{
  const response=new Response(new ReadableStream({start(c){c.error(Error(secret));}}),{headers:{'content-type':'application/json'}});
  await assert.rejects(setup(async()=>response)(prepared()),/^Error: UPLOAD_FAILED$/);
  let calls=0;
  await assert.rejects(setup(async()=>{calls++;return ok();},{tokenProvider:async({signal})=>{assert.ok(signal instanceof AbortSignal);throw new DOMException(secret,'AbortError');}})(prepared()),/^Error: AUTH_UNAVAILABLE$/);
  assert.equal(calls,0);
});

test('retry wait failures do not leak injected exception details',async()=>{
  await assert.rejects(setup(async()=>new Response('',{status:503}),{sleep:async()=>{throw Error(secret);}})(prepared()),/^Error: RETRY_INTERRUPTED_SAME_REQUEST$/);
});
test('hung/late provider is bounded and cannot send after cancellation',async()=>{
  let resolveProvider,calls=0;
  const upload=setup(async()=>{calls++;return ok();},{attemptTimeoutMs:10,tokenProvider:()=>new Promise(resolve=>{resolveProvider=resolve;})});
  await assert.rejects(upload(prepared()),/^Error: AUTH_UNAVAILABLE$/);
  resolveProvider(secret);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);
  assert.throws(()=>setup(undefined,{maxAttempts:4}),/ATTEMPTS_INVALID/);
  assert.throws(()=>setup(undefined,{attemptTimeoutMs:30001}),/TIMEOUT_INVALID/);
});
test('response-body read and cancellation cannot hold the attempt past its deadline',async()=>{
  const stalled=()=>new ReadableStream({pull(){return new Promise(()=>{});},cancel(){return new Promise(()=>{});}});
  const upload=setup(async()=>new Response(stalled(),{headers:{'content-type':'application/json'}}),{attemptTimeoutMs:10,maxAttempts:1});
  let timer;
  try {
    await Promise.race([assert.rejects(upload(prepared()),/^Error: UPLOAD_FAILED$/),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('deadline ignored')),500);})]);
  } finally {clearTimeout(timer);}
  const rejected=setup(async()=>new Response(stalled(),{status:403}),{attemptTimeoutMs:10,maxAttempts:1});
  try {
    await Promise.race([assert.rejects(rejected(prepared()),/^Error: PUBLISH_REJECTED$/),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('cancel hung')),500);})]);
  } finally {clearTimeout(timer);}
});
