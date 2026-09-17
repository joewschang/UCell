/** Synthetic, provider-free smoke harness. Never connects to a database or network. */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { createReadGateway } = require('../packages/shared/dist/index.js');
const end = '2026-09-19T16:00:00.000Z';
const principal = audience => ({ actorId: 'synthetic-actor', audience, personId: 'synthetic-person',
  selectedQualificationId: 'synthetic-ball', contextVersion: '1', correlationId: 'synthetic-trace',
  permissions: ['explain:active:read', 'explain:binary:read', 'explain:reservoir-b:read'] });
const rows = [];
async function scenario(name, tool, query, audience, expected, mutateSource) {
  const audit = [];
  const gateway = createReadGateway({
    resolveContext: async () => principal(audience),
    authorize: async (_context, requestedTool, request) => {
      if (requestedTool === 'explainReservoirB') return request.entryId === 'synthetic-entry'
        ? { qualificationId: 'synthetic-company-ball', entryId: request.entryId, binaryTreeId: 'synthetic-tree' } : null;
      if (request.qualificationId !== 'synthetic-ball' || (request.binaryTreeId && request.binaryTreeId !== 'synthetic-tree')) return null;
      return { qualificationId: request.qualificationId, ...(request.binaryTreeId ? { binaryTreeId: request.binaryTreeId } : {}) };
    },
    read: async (requestedTool, target, request) => {
      const source = { status: 'AVAILABLE', finality: requestedTool === 'getActiveStatus' ? 'NOT_APPLICABLE' : 'FINALIZED',
        scope: target, ...(request.periodEnd ? { periodEnd: request.periodEnd } : {}),
        updatedAt: '2026-09-18T00:00:00.000Z', ruleVersion: 'SYNTHETIC-RULE', parameterVersion: 'SYNTHETIC-PARAMETER',
        evidenceRefs: [{ type: 'SyntheticFixture', id: 'synthetic-evidence', revision: '1' }],
        result: requestedTool === 'getActiveStatus' ? { active: true, ownerType: 'MEMBER', reasonCode: 'THRESHOLD_MET' }
          : requestedTool === 'explainBinaryCarry' ? { leftCarry: '123.4500', rightCarry: '0.0000' }
          : { amount: '-12.5000', currency: 'TWD', kind: 'CORRECTION', adjustsEntryId: 'synthetic-original' } };
      mutateSource?.(source); return source;
    },
    audit: async event => { audit.push(event); },
  });
  let outcome;
  try { const answer = await gateway(tool, query); outcome = answer.status;
    if (name === 'carry precision') assert.equal(answer.result.leftCarry, '123.4500');
    if (name === 'missing source') assert.equal(answer.result, null);
  } catch (error) { if (!error.code) throw error; outcome = error.code; }
  assert.equal(outcome, expected, name);
  rows.push({ name, outcome, passed: true, auditEvents: audit.length });
}
await scenario('owned Active', 'getActiveStatus', { qualificationId: 'synthetic-ball' }, 'MEMBER', 'AVAILABLE');
await scenario('other Ball denied', 'getActiveStatus', { qualificationId: 'other-ball' }, 'MEMBER', 'DENIED');
await scenario('carry precision', 'explainBinaryCarry', { qualificationId: 'synthetic-ball', binaryTreeId: 'synthetic-tree', periodEnd: end }, 'MEMBER', 'AVAILABLE');
await scenario('other tree denied', 'explainBinaryCarry', { qualificationId: 'synthetic-ball', binaryTreeId: 'other-tree', periodEnd: end }, 'MEMBER', 'DENIED');
await scenario('Member B denied', 'explainReservoirB', { entryId: 'synthetic-entry' }, 'MEMBER', 'DENIED');
await scenario('Admin B correction', 'explainReservoirB', { entryId: 'synthetic-entry' }, 'ADMIN', 'AVAILABLE');
await scenario('missing source', 'getActiveStatus', { qualificationId: 'synthetic-ball' }, 'MEMBER', 'UNAVAILABLE', source => {
  source.status = 'UNAVAILABLE'; source.result = null; source.evidenceRefs = [];
});
await scenario('query injection denied', 'getActiveStatus', { qualificationId: 'synthetic-ball', roles: ['ADMIN'] }, 'MEMBER', 'INVALID_QUERY');
console.log(JSON.stringify({ mode: 'SYNTHETIC_NO_PROVIDER_NO_DATABASE', passed: rows.length, scenarios: rows }, null, 2));
