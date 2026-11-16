import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,readdirSync,statSync,symlinkSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {initializeJournal,enqueueJournal,inspectJournal,runJournal} from './retry-journal.mjs';
import {NOW,KEY,URL,TOKEN,prepared,payload,success} from './test-support/fixtures.mjs';
import {prepareRequest} from './uploader.mjs';
function sandbox(t){const parent=mkdtempSync(join(tmpdir(),'ucell-journal-test-'));t.after(()=>rmSync(parent,{recursive:true,force:true}));const directory=join(parent,'journal');initializeJournal(directory);return directory;}
const enqueue=(directory,request=prepared())=>enqueueJournal({directory,publishEndpoint:URL,request,now:()=>NOW});
const inspect=directory=>inspectJournal({directory,date:payload.date});
const run=(directory,transport=async()=>success(),extra={})=>runJournal({directory,date:payload.date,tokenProvider:async()=>TOKEN,transport,now:()=>new Date(NOW.getTime()+10_000),...extra});
test('immutable durable request survives reopen; success is terminal and token never reaches disk',async t=>{
  const directory=sandbox(t);const created=await enqueue(directory);assert.equal(created.state,'READY');assert.equal(created.attempts,0);assert.equal((await enqueue(directory)).digest,created.digest);
  const completed=await run(directory,async(_url,o)=>{assert.equal(o.body,prepared().body);assert.equal(o.headers['Idempotency-Key'],KEY);assert.equal(o.headers.Authorization,'Bearer '+TOKEN);return success();});assert.equal(completed.state,'SUCCEEDED');assert.equal((await inspect(directory)).attempts,1);
  assert.equal((await run(directory,async()=>{throw Error('must not send');})).state,'SUCCEEDED');
  assert.equal((await run(directory,undefined,{now:()=>new Date('2026-11-18T00:00:00Z')})).state,'SUCCEEDED');
  for(const f of readdirSync(directory)){assert.equal(statSync(join(directory,f)).mode&0o077,0);assert.equal(readFileSync(join(directory,f)).includes(Buffer.from(TOKEN)),false);}
  const newKey='22222222-2222-4222-8222-222222222222';await assert.rejects(enqueue(directory,prepareRequest({...payload,title:'午安'},newKey,NOW)),/DATE_RESERVED/);
});
test('transient and ambiguous attempts consume durable budget; restart cannot reset cap',async t=>{
  const directory=sandbox(t);await enqueue(directory);let calls=0,now=new Date(NOW.getTime()+1000);
  const transport=async()=>{calls++;throw Error(TOKEN);};
  assert.equal((await run(directory,transport,{now:()=>now})).state,'RETRYABLE');
  assert.equal((await run(directory,transport,{now:()=>now})).attempts,1);assert.equal(calls,1);
  now=new Date(now.getTime()+10_000);assert.equal((await run(directory,transport,{now:()=>now})).attempts,2);
  now=new Date(now.getTime()+10_000);assert.equal((await run(directory,transport,{now:()=>now})).state,'EXHAUSTED');
  assert.equal((await run(directory,transport,{now:()=>now})).state,'EXHAUSTED');assert.equal(calls,3);
});
test('permanent status/conflict and unavailable auth stop; no automatic replacement',async t=>{
  for(const status of [302,400,401,403,409,500]){
    const directory=sandbox(t);await enqueue(directory);let calls=0;
    assert.equal((await run(directory,async()=>{calls++;return new Response(TOKEN,{status});})).state,'BLOCKED');
    assert.equal((await run(directory,async()=>{calls++;return success();})).state,'BLOCKED');assert.equal(calls,1);
  }
  const directory=sandbox(t);await enqueue(directory);assert.equal((await run(directory,undefined,{tokenProvider:async()=>{throw Error(TOKEN);}})).state,'BLOCKED');
});
test('all transient HTTP statuses and malformed success preserve same request for recovery',async t=>{
  for(const status of [429,502,503,504,200]){
    const directory=sandbox(t);await enqueue(directory);
    const first=await run(directory,async()=>status===200?new Response('{',{headers:{'content-type':'application/json'}}):new Response(TOKEN,{status}));assert.equal(first.state,'RETRYABLE');
    const second=await run(directory,async(_url,o)=>{assert.equal(o.body,prepared().body);assert.equal(o.headers['Idempotency-Key'],KEY);return Response.json({date:payload.date,id:KEY,status:'ALREADY_PUBLISHED'});},{now:()=>new Date(NOW.getTime()+20_000)});assert.equal(second.state,'SUCCEEDED');assert.equal(second.result.status,'ALREADY_PUBLISHED');
  }
});
test('rollover expires pending/uncertain work without network or changing date/key',async t=>{
  const directory=sandbox(t);await enqueue(directory);await run(directory,async()=>{throw Error('unknown');});let calls=0;
  const expired=await run(directory,async()=>{calls++;return success();},{now:()=>new Date('2026-11-17T23:00:00Z')});assert.equal(expired.state,'EXPIRED');assert.equal(expired.attempts,1);assert.equal(expired.idempotencyKey,KEY);assert.equal(calls,0);
});
test('parallel runner is excluded while first worker waits for response',async t=>{
  const directory=sandbox(t);await enqueue(directory);let release,entered;const ready=new Promise(r=>{entered=r;});
  const first=run(directory,async()=>{entered();await new Promise(r=>{release=r;});return success();});await ready;
  await assert.rejects(run(directory),/JOURNAL_BUSY/);release();assert.equal((await first).state,'SUCCEEDED');
});
test('SIGKILL before send and after simulated acceptance releases lock; same request recovers',async t=>{
  for(const phase of ['before-send','accepted-not-recorded']){
    const directory=sandbox(t);const saved=await enqueue(directory);
    const child=fork(fileURLToPath(new globalThis.URL('./test-support/crash-worker.mjs',import.meta.url)),[directory,phase],{stdio:['ignore','ignore','pipe','ipc']});
    t.after(()=>child.kill('SIGKILL'));
    const timeout=setTimeout(()=>child.kill('SIGKILL'),5000);
    const [message]=await once(child,'message');clearTimeout(timeout);
    if(phase==='accepted-not-recorded'){assert.equal(message.key,KEY);assert.equal(message.digest,saved.digest);}
    await assert.rejects(run(directory),/JOURNAL_BUSY/);
    const exited=once(child,'exit');child.kill('SIGKILL');await exited;
    assert.equal((await inspect(directory)).state,'IN_FLIGHT');assert.equal((await inspect(directory)).attempts,1);
    const recovered=await run(directory,async(_url,o)=>{assert.equal(o.body,prepared().body);assert.equal(o.headers['Idempotency-Key'],KEY);return Response.json({date:payload.date,id:KEY,status:'ALREADY_PUBLISHED'});});assert.equal(recovered.state,'SUCCEEDED');assert.equal(recovered.attempts,2);
  }
});
test('corrupt database, digest/state/attempt counter and missing files fail closed',async t=>{
  for(const mutation of ['bytes','digest','state','attempts','missing']){
    const directory=sandbox(t);await enqueue(directory);
    if(mutation==='bytes')writeFileSync(join(directory,'jobs.sqlite'),'CORRUPT');
    else if(mutation==='missing')unlinkSync(join(directory,'jobs.sqlite'));
    else {const db=new DatabaseSync(join(directory,'jobs.sqlite'));if(mutation==='digest'){db.exec('DROP TRIGGER immutable_request');db.prepare('UPDATE jobs SET digest=?').run('bad');}if(mutation==='state')db.prepare('UPDATE jobs SET state=?').run('NOT_A_STATE');if(mutation==='attempts')db.exec('UPDATE jobs SET attempts=99');db.close();}
    let calls=0;await assert.rejects(run(directory,async()=>{calls++;return success();}),/JOURNAL_(CORRUPT|UNAVAILABLE)/);assert.equal(calls,0);
  }
});
test('journal initialization never overwrites existing files; symlinks rejected',async t=>{
  const directory=sandbox(t);assert.throws(()=>initializeJournal(directory),/JOURNAL_INIT_FAILED/);await enqueue(directory);
  const target=join(directory,'jobs.sqlite');const original=readFileSync(target);unlinkSync(target);const other=join(directory,'elsewhere');writeFileSync(other,original,{mode:0o600});symlinkSync(other,target);
  await assert.rejects(run(directory),/JOURNAL_UNAVAILABLE/);
});
test('failed durable reservation prevents send; failed success commit recovers original request',async t=>{
  const directory=sandbox(t);await enqueue(directory);
  let db=new DatabaseSync(join(directory,'jobs.sqlite'));db.exec("CREATE TRIGGER simulate_disk_failure BEFORE UPDATE ON jobs BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");db.close();
  let calls=0;await assert.rejects(run(directory,async()=>{calls++;return success();}),/JOURNAL_UNAVAILABLE/);assert.equal(calls,0);assert.equal((await inspect(directory)).attempts,0);
  db=new DatabaseSync(join(directory,'jobs.sqlite'));db.exec("DROP TRIGGER simulate_disk_failure; CREATE TRIGGER simulate_disk_failure BEFORE UPDATE ON jobs WHEN NEW.state='SUCCEEDED' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");db.close();
  await assert.rejects(run(directory,async()=>{calls++;return success();}),/JOURNAL_UNAVAILABLE/);assert.equal(calls,1);assert.equal((await inspect(directory)).state,'IN_FLIGHT');
  db=new DatabaseSync(join(directory,'jobs.sqlite'));db.exec('DROP TRIGGER simulate_disk_failure');db.close();
  const recovered=await run(directory,async(_url,o)=>{assert.equal(o.body,prepared().body);assert.equal(o.headers['Idempotency-Key'],KEY);return success();},{now:()=>new Date(NOW.getTime()+20_000)});assert.equal(recovered.state,'SUCCEEDED');assert.equal(recovered.attempts,2);
});
test('journal to uploader to native HTTPS adapter preserves request across transient recovery',async t=>{
  const {createHttpsTransport}=await import('./https-adapter.mjs');
  const {EventEmitter}=await import('node:events');const {PassThrough}=await import('node:stream');
  const directory=sandbox(t);await enqueue(directory);const calls=[];
  const transport=createHttpsTransport({publishEndpoint:URL,proxyEnv:{},request:(_url,opts,callback)=>{
    const req=new EventEmitter();req.destroy=()=>{};
    req.end=body=>{calls.push({body,key:opts.headers['Idempotency-Key'],auth:opts.headers.Authorization});queueMicrotask(()=>{
      const res=new PassThrough();res.statusCode=calls.length===1?503:200;res.complete=true;res.headers={'content-type':'application/json'};
      callback(res);if(!res.destroyed)res.end(JSON.stringify({date:payload.date,id:KEY,status:'ALREADY_PUBLISHED'}));
    });};return req;
  }});
  assert.equal((await run(directory,transport)).state,'RETRYABLE');
  assert.equal((await run(directory,transport,{now:()=>new Date(NOW.getTime()+20_000)})).state,'SUCCEEDED');
  assert.equal(calls.length,2);for(const c of calls){assert.equal(c.body,prepared().body);assert.equal(c.key,KEY);assert.equal(c.auth,'Bearer '+TOKEN);}
  for(const name of readdirSync(directory))assert.equal(readFileSync(join(directory,name)).includes(Buffer.from(TOKEN)),false);
});
