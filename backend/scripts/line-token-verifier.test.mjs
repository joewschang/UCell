import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyLineIdToken } from '../apps/api/src/modules/auth/line-token-verifier.ts';
const claims = { iss: 'https://access.line.me', aud: '1234', sub: 'test-subject', iat: 100, exp: 300 };
const config = { channelId: '1234' };
const now = () => 200000;
const deps = payload => ({ now, fetch: async () => new Response(JSON.stringify(payload)) });
test('posts only to the official endpoint and returns minimal verified identity', async () => {
  let calls = 0;
  const result = await verifyLineIdToken('synthetic-token', config, { now, fetch: async (url, init) => {
    calls++; assert.equal(url, 'https://api.line.me/oauth2/v2.1/verify');
    assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
    assert.equal(init.body.get('client_id'), '1234'); assert.equal(init.body.get('id_token'), 'synthetic-token');
    assert.equal(init.body.has('nonce'), false);
    return new Response(JSON.stringify({ ...claims, email: 'private@example.invalid', name: 'private' }));
  }});
  assert.equal(calls, 1); assert.deepEqual(result, { subject: 'test-subject', expiresAt: 300 });
});
test('requires server channel configuration and a bounded token before network access', async () => {
  let calls = 0; const fetch = async () => { calls++; throw Error('unexpected'); };
  for (const token of [undefined, '', ' ', 3, 'x'.repeat(16385)])
    await assert.rejects(verifyLineIdToken(token, config, { fetch }), /LINE_TOKEN_INVALID/);
  await assert.rejects(verifyLineIdToken('token', { channelId: '' }, { fetch }), /LINE_NOT_CONFIGURED/);
  assert.equal(calls, 0);
});
test('rejects issuer, audience, subject and timestamp violations', async () => {
  for (const patch of [{ iss: 'https://attacker.invalid' }, { aud: 'other' }, { sub: '' }, { exp: 200 },
    { exp: '300' }, { iat: 201 }, { iat: null }, { exp: null }])
    await assert.rejects(verifyLineIdToken('token', config, deps({ ...claims, ...patch })), /LINE_CLAIMS_INVALID/);
});
test('sends and checks a server-owned expected nonce', async () => {
  const expectedNonce = 'server-challenge';
  await assert.rejects(verifyLineIdToken('token', { ...config, expectedNonce }, deps(claims)), /LINE_CLAIMS_INVALID/);
  const result = await verifyLineIdToken('token', { ...config, expectedNonce }, { now, fetch: async (_url, init) => {
    assert.equal(init.body.get('nonce'), expectedNonce);
    return new Response(JSON.stringify({ ...claims, nonce: expectedNonce }));
  }});
  assert.equal(result.subject, claims.sub);
});
test('rejects provider errors without reading or exposing their content, never retries', async () => {
  let calls = 0;
  await assert.rejects(verifyLineIdToken('private-token', config, { now, fetch: async () => {
    calls++; return new Response('private-provider-detail', { status: 400 });
  }}), error => error.message === 'LINE_TOKEN_REJECTED');
  assert.equal(calls, 1);
});
test('sanitizes transport and invalid JSON failures', async () => {
  for (const fetch of [async () => { throw Error('private-network-detail'); }, async () => new Response('not json')])
    await assert.rejects(verifyLineIdToken('token', config, { now, fetch }), error => error.message === 'LINE_VERIFICATION_UNAVAILABLE');
});
test('aborts a stalled provider request after the deadline', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const pending = verifyLineIdToken('token', config, { now, fetch: async (_url, init) => {
    signal = init.signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted'))));
  }});
  const rejection = assert.rejects(pending, /LINE_VERIFICATION_UNAVAILABLE/);
  context.mock.timers.tick(8000); await rejection; assert.equal(signal.aborted, true);
});
