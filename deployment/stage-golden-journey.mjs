#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const OPT_IN = 'RUN_STAGE_UAT_GOLDEN_JOURNEY';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function validateConfig(env = process.env) {
  const failures = [];
  if (env.UCELL_ENVIRONMENT !== 'STAGE') failures.push('UCELL_ENVIRONMENT must equal STAGE');
  if (env.UCELL_STAGE_GOLDEN_OPT_IN !== OPT_IN) failures.push(`UCELL_STAGE_GOLDEN_OPT_IN must equal ${OPT_IN}`);
  for (const name of ['UCELL_STAGE_API_BASE_URL', 'UCELL_STAGE_API_ALLOWLIST', 'UCELL_STAGE_UAT_SEED_ENDPOINT', 'UCELL_STAGE_UAT_SEED_BEARER', 'UCELL_STAGE_MEMBER_LINE_ID_TOKEN', 'UCELL_STAGE_OUTSIDER_LINE_ID_TOKEN']) {
    if (!env[name]?.trim()) failures.push(`${name} is required`);
  }
  let base;
  try { base = new URL(env.UCELL_STAGE_API_BASE_URL); } catch { failures.push('UCELL_STAGE_API_BASE_URL must be an absolute URL'); }
  if (base && base.protocol !== 'https:') failures.push('UCELL_STAGE_API_BASE_URL must use https');
  if (base && (base.username || base.password || base.search || base.hash)) failures.push('UCELL_STAGE_API_BASE_URL must not contain credentials, query, or fragment');
  const allowlist = (env.UCELL_STAGE_API_ALLOWLIST ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  if (base && !allowlist.includes(base.origin)) failures.push('Stage API origin is not in UCELL_STAGE_API_ALLOWLIST');
  if (env.UCELL_STAGE_UAT_SEED_ENDPOINT && !/^\/api\/v1\/uat(?:\/|$)/u.test(env.UCELL_STAGE_UAT_SEED_ENDPOINT)) failures.push('UCELL_STAGE_UAT_SEED_ENDPOINT must be under /api/v1/uat');
  return failures;
}

function redact(text, secrets) {
  return secrets.reduce((value, secret) => secret ? value.replaceAll(secret, '[REDACTED]') : value, text);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !['requestId', 'timestamp', 'generatedAt'].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]));
}

function includesValue(value, expected) {
  if (value === expected) return true;
  if (Array.isArray(value)) return value.some((child) => includesValue(child, expected));
  return Boolean(value && typeof value === 'object' && Object.values(value).some((child) => includesValue(child, expected)));
}

function findQualificationList(value) {
  if (Array.isArray(value) && value.some((item) => item && typeof item === 'object' && ('id' in item || 'qualificationId' in item))) return value;
  if (!value || typeof value !== 'object') return undefined;
  for (const child of Object.values(value)) {
    const found = findQualificationList(child);
    if (found) return found;
  }
}

export async function runJourney(env = process.env, fetchImpl = fetch) {
  const configFailures = validateConfig(env);
  if (configFailures.length) return { status: 'BLOCKED', failures: configFailures, checks: [] };
  const base = new URL(env.UCELL_STAGE_API_BASE_URL);
  const secrets = [env.UCELL_STAGE_UAT_SEED_BEARER, env.UCELL_STAGE_MEMBER_LINE_ID_TOKEN, env.UCELL_STAGE_OUTSIDER_LINE_ID_TOKEN];
  const checks = [];
  let sequence = 0;
  async function request(name, path, { method = 'GET', bearer, body, expected = [200] } = {}) {
    if (!/^\/api\/v1\//u.test(path) || path.includes('..')) throw new Error(`${name}: endpoint is outside /api/v1 allowlist`);
    const url = new URL(path, base);
    if (url.origin !== base.origin) throw new Error(`${name}: cross-origin endpoint denied`);
    const headers = { accept: 'application/json' };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    if (body !== undefined) { headers['content-type'] = 'application/json'; headers['idempotency-key'] = `stage-golden-${Date.now()}-${++sequence}`; }
    let response;
    try { response = await fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000) }); }
    catch (error) { throw new Error(`${name}: HTTP unavailable: ${error.message}`); }
    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { nonJsonBody: text.slice(0, 200) }; }
    checks.push({ name, method, path: url.pathname, status: response.status, result: expected.includes(response.status) ? 'PASS' : 'FAIL' });
    if (!expected.includes(response.status)) throw new Error(`${name}: expected HTTP ${expected.join('/')} but received ${response.status}`);
    return payload;
  }
  try {
    const seed = await request('uat-seed', env.UCELL_STAGE_UAT_SEED_ENDPOINT, { method: 'POST', bearer: env.UCELL_STAGE_UAT_SEED_BEARER, body: { scenario: 'GOLDEN_JOURNEY_TWO_BALL_V1' }, expected: [200, 201] });
    const fixture = seed?.data ?? seed;
    for (const key of ['ball1QualificationId', 'ball2QualificationId', 'outsiderQualificationId']) if (!UUID.test(fixture?.[key] ?? '')) throw new Error(`uat-seed: ${key} missing or invalid`);
    if (!fixture?.orderBody || typeof fixture.orderBody !== 'object') throw new Error('uat-seed: orderBody missing');

    const login = async (name, idToken) => request(name, '/api/v1/auth/member/line/exchange', { method: 'POST', body: { idToken }, expected: [200, 201] });
    const memberLogin = await login('member-login', env.UCELL_STAGE_MEMBER_LINE_ID_TOKEN);
    const outsiderLogin = await login('outsider-login', env.UCELL_STAGE_OUTSIDER_LINE_ID_TOKEN);
    const memberBearer = memberLogin?.data?.accessToken ?? memberLogin?.accessToken;
    const outsiderBearer = outsiderLogin?.data?.accessToken ?? outsiderLogin?.accessToken;
    if (!memberBearer || !outsiderBearer) throw new Error('login: accessToken missing');

    await request('session-person', '/api/v1/member/me', { bearer: memberBearer });
    const qualifications = await request('person-two-qualifications', '/api/v1/member/qualifications', { bearer: memberBearer });
    const qualificationList = findQualificationList(qualifications);
    if (qualificationList?.length !== 2 || !includesValue(qualificationList, fixture.ball1QualificationId) || !includesValue(qualificationList, fixture.ball2QualificationId)) throw new Error('person-two-qualifications: expected exactly seeded Ball1 and Ball2');
    await request('ball1-context', '/api/v1/member/context/qualification', { method: 'POST', bearer: memberBearer, body: { qualificationId: fixture.ball1QualificationId }, expected: [200, 201] });

    const scoped = async (name, suffix, qualificationId = fixture.ball1QualificationId) => request(name, `/api/v1/member/${suffix}?qualificationId=${encodeURIComponent(qualificationId)}`, { bearer: memberBearer });
    const ball1Dashboard = await scoped('ball1-dashboard', 'dashboard');
    await scoped('ball1-sponsor', 'organization/sponsor');
    await scoped('ball1-binary', 'organization/binary');
    await scoped('ball1-performance', 'performance');
    await scoped('ball1-bonus', 'bonuses');
    await scoped('ball1-ledger', 'bonuses/ledger');
    const ball2Dashboard = await scoped('ball2-isolation', 'dashboard', fixture.ball2QualificationId);
    if (!includesValue(ball1Dashboard, fixture.ball1QualificationId) || !includesValue(ball2Dashboard, fixture.ball2QualificationId)) throw new Error('ball isolation: dashboard qualification identity missing');
    await request('outsider-qualification-deny', `/api/v1/member/dashboard?qualificationId=${encodeURIComponent(fixture.ball1QualificationId)}`, { bearer: outsiderBearer, expected: [403] });

    await request('products', '/api/v1/member/products', { bearer: memberBearer });
    const created = await request('create-order', '/api/v1/member/orders', { method: 'POST', bearer: memberBearer, body: fixture.orderBody, expected: [200, 201] });
    const orderId = created?.data?.id ?? created?.id;
    if (!UUID.test(orderId ?? '')) throw new Error('create-order: order id missing or invalid');
    await request('order-detail', `/api/v1/member/orders/${orderId}?qualificationId=${encodeURIComponent(fixture.ball1QualificationId)}`, { bearer: memberBearer });
    await scoped('notifications', 'notifications');
    await request('profile-readback', '/api/v1/member/me', { bearer: memberBearer });

    for (const [name, path] of Object.entries(fixture.paymentReadback ?? {})) await request(`payment-${name}-readback`, path, { bearer: memberBearer });
    if (!fixture.paymentReadback) checks.push({ name: 'payment-inventory-notification-readback', result: 'SKIP', reason: 'seed reported capability unavailable' });

    await request('ball1-context-restore', '/api/v1/member/context/qualification', { method: 'POST', bearer: memberBearer, body: { qualificationId: fixture.ball1QualificationId }, expected: [200, 201] });
    const restored = await scoped('ball1-deterministic-readback', 'dashboard');
    if (JSON.stringify(stable(restored)) !== JSON.stringify(stable(ball1Dashboard))) throw new Error('ball1 deterministic readback differs after Ball2 switch');
    return { status: 'PASS', checks };
  } catch (error) {
    return { status: 'BLOCKED', failures: [redact(error.message, secrets)], checks };
  }
}

async function main() {
  const result = await runJourney();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
