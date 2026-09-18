import assert from 'node:assert/strict';
import { verifyCarryHttp } from './member-explain-carry-http-cases.mjs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const target = new URL(process.env.DATABASE_URL ?? '');
assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
assert.match(target.pathname, /^\/ucell_explain_[a-f0-9]{32}$/);
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { PrismaService, recognizeConsumption, taipeiMonth } = require('@ucell/database');
const load = path => require(fileURLToPath(new URL('../apps/api/dist/' + path + '.js', import.meta.url)));
const { MemberExplainController } = load('modules/member/member-explain.controller');
const { MemberExplainService } = load('modules/member/member-explain.service');
const { MemberAuthenticationGuard } = load('modules/auth/member-authentication.guard');
const { MemberContextGuard } = load('modules/member/member-context.guard');
const { QualificationAccessService } = load('modules/auth/qualification-access.service');
const { IdentityTokenService } = load('modules/auth/identity-token.service');
const { LineIdentityService } = load('modules/auth/line-identity.service');
const { EnvelopeInterceptor } = load('common/interceptors/envelope.interceptor');

let app;
let db;
let assertions = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; };
try {
  const module = await Test.createTestingModule({ controllers: [MemberExplainController],
    providers: [PrismaService, MemberExplainService, MemberAuthenticationGuard, MemberContextGuard,
      QualificationAccessService, IdentityTokenService, LineIdentityService],
  }).compile();
  app = module.createNestApplication(new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  await app.init(); await app.getHttpAdapter().getInstance().ready();
  db = module.get(PrismaService);
  const tokens = module.get(IdentityTokenService);
  const person = await db.person.create({ data: { legalName: 'TEST ONLY HTTP Member', status: 'EFFECTIVE', membershipState: 'NETWORK_MEMBER' } });
  const outsider = await db.person.create({ data: { legalName: 'TEST ONLY HTTP Other', status: 'EFFECTIVE', membershipState: 'NETWORK_MEMBER' } });
  const subject = 'test-only-line-' + randomUUID();
  await db.identityLink.create({ data: { personId: person.personId, provider: 'LINE', providerSubject: subject } });
  const session = await tokens.issue({ provider: 'LINE', personId: person.personId, subject });
  const headers = { authorization: 'Bearer ' + session.accessToken };
  async function ball(holder = person.personId) {
    const value = await db.qualification.create({ data: { currentHolderPersonId: holder,
      planLevelCode: 'LEADER', status: 'EFFECTIVE', effectiveAt: new Date() } });
    await db.qualificationHolderHistory.create({ data: { qualificationId: value.qualificationId,
      holderPersonId: holder, effectiveFrom: new Date(), sourceType: 'TEST_ONLY_HTTP' } });
    return value.qualificationId;
  }
  const qid = await ball();
  const url = '/api/v1/member/explain/active?qualificationId=' + qid;
  const request = (query = url, auth = headers) => app.inject({ method: 'GET', url: query, headers: auth });
  const audits = () => db.auditEvent.findMany({ where: { actorId: person.personId, action: 'MEMBER_EXPLAIN_READ' }, orderBy: { occurredAt: 'asc' } });
  eq((await request(url, {})).statusCode, 401, 'missing bearer rejected');
  eq((await request(url, { authorization: 'Bearer nonexistent' })).statusCode, 401, 'unknown stored session rejected');
  eq((await audits()).length, 0, 'unauthenticated request never reaches domain read');
  eq((await request(url + '&roles=ADMIN')).statusCode, 400, 'unknown role query rejected');
  eq((await request()).statusCode, 422, 'owned Ball with no evidence remains unavailable');
  eq((await audits())[0].afterData.outcome, 'HISTORICAL_UNAVAILABLE', 'unavailable read is persisted to audit');

  const recognize = amount => db.$transaction(tx => recognizeConsumption(tx, { qualificationId: qid,
    sourceType: 'TEST_ONLY_HTTP', sourceId: randomUUID(), amount, eligible: true, concreteVolumeType: 'GPV',
    productProfileVersion: 'TEST_ONLY', ruleVersionCode: 'R1.0B', parameterSnapshotHash: 'a'.repeat(64),
    recognizedAt: taipeiMonth(new Date()).start, activeThreshold: '2000',
  }), { isolationLevel: 'Serializable' });
  await recognize('1999.9999');
  let response = await request();
  eq(response.statusCode, 200, 'real stored session and original evidence accepted');
  eq(response.json().data.result, { active: false, ownerType: 'MEMBER', reasonCode: 'BELOW_THRESHOLD' }, 'below-threshold HTTP projection');
  eq(response.headers['cache-control'], 'no-store', 'sensitive response is not cached');
  eq(response.json().data.scope, { qualificationId: qid }, 'selected Ball scope');
  eq(response.json().data.evidenceRefs.length, 2, 'negative evidence references survive gateway');
  assert.ok(!response.body.includes(subject) && !response.body.includes(session.accessToken)); assertions++;
  await recognize('0.0001');
  response = await request();
  eq(response.statusCode, 200, 'crossing evidence available through HTTP');
  eq(response.json().data.result.active, true, 'crossing becomes Active');
  eq(response.json().data.evidenceRefs.length, 3, 'positive evidence references survive gateway');
  const successes = (await audits()).filter(row => row.afterData.outcome === 'AVAILABLE');
  eq(successes.length, 2, 'both successful results persist audit rows');
  eq(Object.keys(successes[0].afterData).sort(), ['definitionVersion', 'outcome', 'tool'], 'audit contains only contract metadata');
  eq(successes[0].actorType, 'MEMBER', 'audit actor type');
  eq(successes[0].entityId, qid, 'audit Ball identity');
  eq(successes[0].requestId, successes[0].correlationId, 'server-generated correlation is persisted');
  assert.ok(!JSON.stringify(successes).includes(session.accessToken) && !JSON.stringify(successes).includes(subject)); assertions++;

  const foreign = await ball(outsider.personId);
  eq((await request(url.replace(qid, foreign))).statusCode, 403, 'another holder denied by database-backed guard');
  // Holder history alone must not override a disagreeing current owner.
  await db.qualification.update({ where: { qualificationId: qid }, data: { currentHolderPersonId: outsider.personId } });
  response = await request();
  eq(response.statusCode, 403, 'current owner mismatch denied by service');
  eq((await audits()).at(-1).afterData.outcome, 'DENIED', 'service authorization denial audited');
  assert.ok(!response.body.includes('THRESHOLD_MET')); assertions++;
  await db.qualification.update({ where: { qualificationId: qid }, data: { currentHolderPersonId: person.personId } });

  await verifyCarryHttp({ db, qid, foreign, request, eq, audits });

  await db.authSession.update({ where: { authSessionId: session.sessionId }, data: { status: 'REVOKED', revokedAt: new Date() } });
  eq((await request()).statusCode, 401, 'revoked real session rejected');
  const expired = await tokens.issue({ provider: 'LINE', personId: person.personId, subject, ttlSeconds: -1 });
  eq((await request(url, { authorization: 'Bearer ' + expired.accessToken })).statusCode, 401, 'expired real session rejected');
  const admin = await tokens.issue({ provider: 'ADMIN_LOCAL', personId: person.personId, subject, roleCode: 'ADMIN' });
  eq((await request(url, { authorization: 'Bearer ' + admin.accessToken })).statusCode, 401, 'admin session cannot become Member');
  const unbound = await tokens.issue({ provider: 'LINE', personId: person.personId, subject: 'unbound-' + randomUUID() });
  eq((await request(url, { authorization: 'Bearer ' + unbound.accessToken })).statusCode, 401, 'unbound LINE identity rejected');
  console.log('MEMBER_EXPLAIN_HTTP_DB_PASS: ' + assertions + ' assertions; real Nest HTTP pipeline, Prisma, sessions, ownership, source and audit');
} finally {
  try { if (app) await app.close(); } finally { if (db) await db.$disconnect(); }
}
