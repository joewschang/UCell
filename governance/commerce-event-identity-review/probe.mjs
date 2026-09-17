import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
const snapshot = JSON.parse(fs.readFileSync(new URL('snapshot.json', import.meta.url), 'utf8'));
const hashes = {};
for (const [name, file] of Object.entries(snapshot.files)) {
  const body = Buffer.from(file.content);
  assert.equal(createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex'), file.sha);
  hashes[name] = createHash('sha256').update(body).digest('hex');
}
const url = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}`;
let source = snapshot.files['provider-event-canonicalizer.ts'].content;
const replacements = [
  ["import { requestHash } from '../../common/utils/hash';", `import { requestHash } from '${url(snapshot.files['hash.ts'].content)}';`],
  ["import { PaymentEvidenceSource } from './canonical-payment-transition';", ''],
  ["import { sanitizePaymentEvidenceMetadata, SafePaymentEvidenceValue } from './payment-evidence-sanitizer';", `import { sanitizePaymentEvidenceMetadata } from '${url(snapshot.files['payment-evidence-sanitizer.ts'].content)}';`],
  ["import { CanonicalPaymentStatus, PaymentProvider, VerifiedProviderEvent } from './payment-provider.adapter';", ''],
];
for (const [before, after] of replacements) { assert.ok(source.includes(before)); source = source.replace(before, after); }
const { canonicalizeProviderEvent: canonicalize } = await import(url(source));
const base = { provider: 'TAISHIN_ECOM', source: 'VERIFIED_WEBHOOK', providerTransactionRef: 'tx-fixture', status: 'PAID', metadata: { amount: '100.00', currency: 'TWD' } };
const results = [];
function test(id, category, description, run) {
  try { run(); results.push({ id, category, description, status: 'PASS' }); }
  catch (error) { results.push({ id, category, description, status: 'FAIL', assertion: error.code ?? error.name }); }
}
test('E01', 'regression', 'Metadata key order preserves hash', () => assert.equal(canonicalize(base).payloadHash, canonicalize({ ...base, metadata: { currency: 'TWD', amount: '100.00' } }).payloadHash));
test('E02', 'regression', 'Blank explicit event ID is rejected', () => assert.throws(() => canonicalize({ ...base, providerEventId: ' ' })));
test('E03', 'regression', 'Explicit event identity is stable across business evidence changes while hash differs', () => {
  const a = canonicalize({ ...base, providerEventId: 'event-fixture' });
  const b = canonicalize({ ...base, providerEventId: 'event-fixture', status: 'REFUNDED' });
  assert.equal(a.providerEventIdentity, b.providerEventIdentity); assert.notEqual(a.payloadHash, b.payloadHash);
});
test('E04', 'observed-limitation', 'Webhook and query without explicit ID produce distinct identities', () => assert.notEqual(canonicalize(base).providerEventIdentity, canonicalize({ ...base, source: 'PROVIDER_QUERY' }).providerEventIdentity));
test('E05', 'observed-limitation', 'Same explicit event ID across sources has different hash', () => {
  const a = canonicalize({ ...base, providerEventId: 'event-fixture' });
  const b = canonicalize({ ...base, providerEventId: 'event-fixture', source: 'PROVIDER_QUERY' });
  assert.equal(a.providerEventIdentity, b.providerEventIdentity); assert.notEqual(a.payloadHash, b.payloadHash);
});
test('E06', 'observed-limitation', 'Redelivery timestamp differences change fallback identity', () => assert.notEqual(canonicalize({ ...base, occurredAt: new Date(0) }).providerEventIdentity, canonicalize({ ...base, occurredAt: new Date(1000) }).providerEventIdentity));
test('E07', 'observed-limitation', 'Correlation metadata differences change fallback identity', () => assert.notEqual(canonicalize({ ...base, metadata: { ...base.metadata, correlationId: 'request-a' } }).providerEventIdentity, canonicalize({ ...base, metadata: { ...base.metadata, correlationId: 'request-b' } }).providerEventIdentity));
test('E08', 'boundary-proposal', 'Runtime browser input is rejected before constructing a VerifiedProviderEvent', () => assert.throws(() => canonicalize({ ...base, source: 'BROWSER_RETURN' })));
test('E09', 'boundary-proposal', 'Runtime unknown provider is rejected', () => assert.throws(() => canonicalize({ ...base, provider: 'UNCONFIGURED_PROVIDER' })));
test('E10', 'boundary-proposal', 'Runtime unknown canonical status is rejected', () => assert.throws(() => canonicalize({ ...base, status: 'UNRECOGNIZED_STATUS' })));
test('E11', 'evidence-integrity', 'Caller Date mutation does not change already returned evidence', () => {
  const date = new Date(0); const event = canonicalize({ ...base, occurredAt: date }); const original = event.occurredAt.toISOString();
  date.setTime(1000); assert.equal(event.occurredAt.toISOString(), original);
});
test('E12', 'evidence-integrity', 'NaN is rejected before evidence hashing', () => assert.throws(() => canonicalize({ ...base, metadata: { ...base.metadata, result: Number.NaN } })));
test('E13', 'observed-limitation', 'NaN and null produce identical evidence hashes', () => assert.equal(canonicalize({ ...base, metadata: { result: Number.NaN } }).payloadHash, canonicalize({ ...base, metadata: { result: null } }).payloadHash));
test('E14', 'regression', 'Secret signature changes do not change sanitized hash', () => assert.equal(canonicalize({ ...base, metadata: { ...base.metadata, signature: 'SYNTHETIC_A' } }).payloadHash, canonicalize({ ...base, metadata: { ...base.metadata, signature: 'SYNTHETIC_B' } }).payloadHash));
const output = { sourceRef: snapshot.ref, checkedAt: new Date().toISOString(), sourceIntegrity: 'PASS', sourceHashes: hashes, node: process.version, scope: 'Isolated exact-source helper execution; imports rebound to snapshotted dependencies; no app build, typecheck, DB or HTTP testing', interpretation: 'Observed-limitation PASS confirms a risk-relevant behavior, not acceptance of business idempotency. Boundary-proposal failures require ingress responsibility to be settled; no exposed API vulnerability is claimed.', total: results.length, pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length, results };
fs.writeFileSync(new URL('results.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ total: output.total, pass: output.pass, fail: output.fail, failures: results.filter(x => x.status === 'FAIL').map(x => x.id) }));
process.exitCode = output.fail ? 1 : 0;
