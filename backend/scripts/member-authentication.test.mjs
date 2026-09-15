import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticateMemberRequest } from '../apps/api/src/modules/auth/member-authentication.ts';

const session = { sessionId: 'session-1', personId: 'person-1', provider: 'LINE', subject: 'line-1', role: null };
const binding = { provider: 'LINE', providerSubject: 'line-1', personId: 'person-1' };
const request = () => ({ headers: { authorization: 'Bearer server-session' }, user: { personId: 'forged' } });
const dependencies = (overrides = {}) => ({
  authenticate: async () => session,
  resolveLineSubject: async () => binding,
  ...overrides,
});

test('uses the server token and current binding, exposes only the verified principal', async () => {
  const req = request();
  const principal = await authenticateMemberRequest(req, dependencies({
    authenticate: async token => { assert.equal(token, 'server-session'); return { ...session, secret: 'hidden' }; },
    resolveLineSubject: async subject => { assert.equal(subject, 'line-1'); return binding; },
  }));
  assert.deepEqual(principal, { sessionId: 'session-1', personId: 'person-1', provider: 'LINE', subject: 'line-1' });
  assert.equal(req.user, principal);
});

test('rejects missing, duplicate, oversized and malformed credentials before services run', async () => {
  for (const authorization of [undefined, [], ['Bearer a', 'Bearer b'], 'Basic a', 'Bearer ', 'Bearer a b', 'Bearer a\n', 'Bearer a, Bearer b', `Bearer ${'a'.repeat(8192)}`]) {
    const req = { headers: { authorization }, user: session };
    await assert.rejects(authenticateMemberRequest(req, dependencies({ authenticate: async () => assert.fail('must not authenticate') })), /MEMBER_BEARER_REQUIRED/);
    assert.equal(req.user, undefined);
  }
});

test('invalid, expired or revoked service results fail closed without identity lookup', async () => {
  const req = request();
  await assert.rejects(authenticateMemberRequest(req, dependencies({
    authenticate: async () => { throw Error('SESSION_INVALID private-details'); },
    resolveLineSubject: async () => assert.fail('must not resolve'),
  })), error => error.message === 'MEMBER_SESSION_INVALID');
  assert.equal(req.user, undefined);
});

test('rejects Admin providers, roles and incomplete sessions', async () => {
  for (const value of [null, [], { ...session, provider: 'ADMIN_LOCAL' }, { ...session, provider: 'ENTRA' },
    { ...session, role: 'ADMIN' }, { ...session, role: '' }, { ...session, personId: null },
    { ...session, personId: '' }, { ...session, subject: ' ' }, { ...session, sessionId: undefined }]) {
    const req = request();
    await assert.rejects(authenticateMemberRequest(req, dependencies({ authenticate: async () => value,
      resolveLineSubject: async () => assert.fail('must not resolve') })), /MEMBER_SESSION_INVALID/);
    assert.equal(req.user, undefined);
  }
});

test('rejects missing or changed LINE bindings and unrelated provider results', async () => {
  for (const value of [null, {}, { ...binding, personId: 'another-person' },
    { ...binding, providerSubject: 'another-line' }, { ...binding, provider: 'ENTRA' }]) {
    const req = request();
    await assert.rejects(authenticateMemberRequest(req, dependencies({ resolveLineSubject: async () => value })), /MEMBER_IDENTITY_MISMATCH/);
    assert.equal(req.user, undefined);
  }
});

test('binding service failure is sanitized and never falls back to the session Person', async () => {
  const req = request();
  await assert.rejects(authenticateMemberRequest(req, dependencies({
    resolveLineSubject: async () => { throw Error('database credentials'); },
  })), error => error.message === 'MEMBER_IDENTITY_UNAVAILABLE');
  assert.equal(req.user, undefined);
});

test('clears the old principal synchronously and only assigns after binding resolves', async () => {
  let complete;
  const req = request();
  const pending = authenticateMemberRequest(req, dependencies({
    resolveLineSubject: () => new Promise(resolve => { complete = resolve; }),
  }));
  assert.equal(req.user, undefined);
  await Promise.resolve();
  assert.equal(req.user, undefined);
  complete(binding);
  await pending;
  assert.equal(req.user.personId, 'person-1');
});

test('rechecks the binding on subsequent requests instead of caching a previous success', async () => {
  let current = binding;
  const deps = dependencies({ resolveLineSubject: async () => current });
  const req = request();
  await authenticateMemberRequest(req, deps);
  current = { ...binding, personId: 'new-holder' };
  await assert.rejects(authenticateMemberRequest(req, deps), /MEMBER_IDENTITY_MISMATCH/);
  assert.equal(req.user, undefined);
});
