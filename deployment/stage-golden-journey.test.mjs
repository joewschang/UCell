import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runJourney, validateConfig } from './stage-golden-journey.mjs';

const ids = { ball1QualificationId:'11111111-1111-4111-8111-111111111111', ball2QualificationId:'22222222-2222-4222-8222-222222222222', outsiderQualificationId:'33333333-3333-4333-8333-333333333333' };
const env = { UCELL_ENVIRONMENT:'STAGE', UCELL_STAGE_GOLDEN_OPT_IN:'RUN_STAGE_UAT_GOLDEN_JOURNEY', UCELL_STAGE_API_BASE_URL:'https://stage-api.example.test', UCELL_STAGE_API_ALLOWLIST:'https://stage-api.example.test', UCELL_STAGE_UAT_SEED_ENDPOINT:'/api/v1/uat/golden-journey/seed', UCELL_STAGE_UAT_SEED_BEARER:'seed-secret', UCELL_STAGE_MEMBER_LINE_ID_TOKEN:'member-secret', UCELL_STAGE_OUTSIDER_LINE_ID_TOKEN:'outsider-secret' };

test('fails closed without stage allowlist, opt-in, endpoint, and credentials', () => {
  assert.ok(validateConfig({}).length >= 6);
  assert.match(validateConfig({ ...env, UCELL_STAGE_API_ALLOWLIST:'https://other.example.test' }).join('\n'), /not in/);
  assert.match(validateConfig({ ...env, UCELL_STAGE_API_BASE_URL:'http://stage-api.example.test' }).join('\n'), /https/);
});

test('mocked HTTP journey covers seed, two balls, foreign denial, order, and deterministic restore', async () => {
  const calls=[];
  const mock = async (url, init) => {
    calls.push([url.pathname + url.search, init.method]);
    let status=200, body={ data:{ qualificationId:ids.ball1QualificationId } };
    if(url.pathname.includes('/uat/')) body={data:{...ids,orderBody:{qualificationId:ids.ball1QualificationId,items:[{productId:'44444444-4444-4444-8444-444444444444',quantity:1}]}}};
    else if(url.pathname.endsWith('/line/exchange')) { status=201; body={data:{accessToken:init.body.includes('outsider')?'outside-token':'member-token'}}; }
    else if(url.pathname.endsWith('/qualifications')) body={data:[{id:ids.ball1QualificationId},{id:ids.ball2QualificationId}]};
    else if(url.pathname.endsWith('/context/qualification')) status=201;
    else if(url.pathname.endsWith('/dashboard')) { if(init.headers.authorization==='Bearer outside-token') status=403; else body={data:{qualificationId:url.searchParams.get('qualificationId'),metric:7}}; }
    else if(url.pathname.endsWith('/orders') && init.method==='POST') {status=201;body={data:{id:'55555555-5555-4555-8555-555555555555'}};}
    return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  };
  const result=await runJourney(env,mock);
  assert.equal(result.status,'PASS');
  assert.equal(result.checks.find((x)=>x.name==='outsider-qualification-deny').status,403);
  assert.equal(result.checks.find((x)=>x.name==='payment-inventory-notification-readback').result,'SKIP');
  assert.ok(calls.some(([path,method])=>path.includes('/orders/55555555-5555-4555-8555-555555555555')&&method==='GET'));
});

test('missing seed contract is BLOCKED and secrets are redacted', async () => {
  const result=await runJourney(env,async()=>new Response(JSON.stringify({error:'seed-secret'}),{status:404}));
  assert.equal(result.status,'BLOCKED');
  assert.doesNotMatch(JSON.stringify(result),/seed-secret/);
  assert.match(result.failures[0],/expected HTTP/);
});
