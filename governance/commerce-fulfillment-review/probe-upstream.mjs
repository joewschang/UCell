import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(fs.readFileSync(path.join(here, 'upstream-snapshot.json'), 'utf8'));
assert.equal(snapshot.ref, 'b1acc4d986fb37364905bea11843b24d53e4fbb3');
const hashes = {};
for (const [name, file] of Object.entries(snapshot.files)) {
  const body = Buffer.from(file.content);
  const blob = createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
  assert.equal(blob, file.sha, `Git blob mismatch: ${name}`);
  hashes[name] = { gitBlob: blob, sha256: createHash('sha256').update(body).digest('hex') };
}
async function load(name, typeImport) {
  let source = snapshot.files[name].content;
  if (typeImport) {
    assert.ok(source.startsWith(typeImport));
    // This exact import has only type usages. No runtime statements are changed.
    source = source.slice(typeImport.length);
  }
  const js = stripTypeScriptTypes(source, { mode: 'transform' });
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { sanitizePaymentEvidenceMetadata: sanitize } = await load('payment-evidence-sanitizer.ts');
const { assertCanonicalPaymentTransition: transition, classifyProviderEvent } = await load(
  'canonical-payment-transition.ts', "import { CanonicalPaymentStatus } from './payment-provider.adapter';\n",
);
const { PaymentProviderRegistry: Registry } = await load(
  'payment-provider.registry.ts', "import { PaymentProvider, PaymentProviderAdapter } from './payment-provider.adapter';\n",
);
const results = [];
function test(id, category, requirement, fn) {
  try { fn(); results.push({ id, category, requirement, status: 'PASS' }); }
  catch (error) {
    // Do not copy input or exception details into audit output: synthetic secrets stay in memory.
    results.push({ id, category, requirement, status: 'FAIL', assertion: error.code ?? error.name });
  }
}
const code = expected => error => error?.code === expected;
const paid = evidence => transition('PENDING', 'PAID', evidence);
const posRefs = { providerTransactionRef: 'tx-fixture', recordedBy: 'operator-fixture', terminalRef: 'terminal-fixture' };
test('P01', 'existing-behavior', 'Browser redirect cannot establish PAID', () =>
  assert.throws(() => paid({ source: 'BROWSER_RETURN' }), code('PAYMENT_EVIDENCE_UNTRUSTED')));
test('P02', 'existing-behavior', 'Webhook with false signature is rejected', () =>
  assert.throws(() => paid({ source: 'VERIFIED_WEBHOOK', signatureVerified: false, providerEventIdentity: 'event-fixture', providerTransactionRef: 'tx-fixture' }), code('PAYMENT_EVIDENCE_INCOMPLETE')));
test('P03', 'existing-behavior', 'Complete asserted verified webhook passes helper', () =>
  assert.doesNotThrow(() => paid({ source: 'VERIFIED_WEBHOOK', signatureVerified: true, providerEventIdentity: 'event-fixture', providerTransactionRef: 'tx-fixture' })));
test('P04', 'boundary-proposal', 'POS references alone cannot prove verified reconciliation', () =>
  assert.throws(() => paid({ source: 'CONTROLLED_POS_EVIDENCE', ...posRefs })));
test('P05', 'boundary-proposal', 'Query reference alone cannot prove provider verification', () =>
  assert.throws(() => paid({ source: 'PROVIDER_QUERY', providerTransactionRef: 'tx-fixture' })));
test('P06', 'runtime-input-hardening', 'Unknown evidence source must fail closed', () =>
  assert.throws(() => paid({ source: 'UNRECOGNIZED_SOURCE', ...posRefs })));
test('P07', 'existing-behavior', 'Same provider event hash classifies as REPLAY', () =>
  assert.equal(classifyProviderEvent('hash-a', 'hash-a').result, 'REPLAY'));
test('P08', 'existing-behavior', 'Conflicting provider event hash classifies as CONFLICT', () =>
  assert.equal(classifyProviderEvent('hash-a', 'hash-b').result, 'CONFLICT'));
test('S01', 'existing-behavior', 'Known secret key is redacted', () =>
  assert.equal(sanitize({ merchantSecret: 'SYNTHETIC_TEST_SECRET' }).merchantSecret, '[REDACTED]'));
test('S02', 'existing-behavior', 'Explicit PAN field is rejected', () =>
  assert.throws(() => sanitize({ pan: 'SYNTHETIC_NON_CARD_VALUE' }), code('CARDHOLDER_DATA_FORBIDDEN')));
test('S03', 'existing-behavior', 'Date nested in metadata is rejected', () =>
  assert.throws(() => sanitize({ time: new Date(0) }), code('PAYMENT_EVIDENCE_UNSUPPORTED_VALUE')));
test('S04', 'serialization', 'NaN cannot silently serialize as null evidence', () =>
  assert.throws(() => sanitize({ result: Number.NaN }), code('PAYMENT_EVIDENCE_UNSUPPORTED_VALUE')));
test('S05', 'serialization', 'Infinity cannot silently serialize as null evidence', () =>
  assert.throws(() => sanitize({ result: Number.POSITIVE_INFINITY }), code('PAYMENT_EVIDENCE_UNSUPPORTED_VALUE')));
test('S06', 'boundary-proposal', 'Likely PAN detection also rejects numeric metadata values', () =>
  assert.throws(() => sanitize({ unclassifiedField: Number('4111'.padEnd(16, '1')) }), code('CARDHOLDER_DATA_FORBIDDEN')));
test('S07', 'boundary-proposal', 'Unapproved secret alias is rejected or redacted before persistence', () => {
  let value;
  try { value = sanitize({ providerSecret: 'SYNTHETIC_TEST_SECRET' }); } catch { return; }
  assert.notEqual(value.providerSecret, 'SYNTHETIC_TEST_SECRET');
});
test('S08', 'existing-behavior', 'Safe identifiers preserve shape without mutating input', () => {
  const value = { providerTransactionRef: 'tx-fixture', nested: { token: 'SYNTHETIC_TEST_SECRET' } };
  assert.deepEqual(sanitize(value), { providerTransactionRef: 'tx-fixture', nested: { token: '[REDACTED]' } });
  assert.equal(value.nested.token, 'SYNTHETIC_TEST_SECRET');
});
const adapter = { provider: 'TAISHIN_ECOM' }; // Registry never invokes adapter operations.
test('R01', 'existing-behavior', 'Missing provider config defaults disabled', () =>
  assert.throws(() => new Registry([adapter], {}).resolve(adapter.provider), code('PAYMENT_PROVIDER_DISABLED')));
test('R02', 'existing-behavior', 'CONFIG_PENDING blocks resolution', () =>
  assert.throws(() => new Registry([adapter], { TAISHIN_ECOM: 'CONFIG_PENDING' }).resolve(adapter.provider), code('PAYMENT_PROVIDER_CONFIG_PENDING')));
test('R03', 'existing-behavior', 'ENABLED without adapter fails closed', () =>
  assert.throws(() => new Registry([], { TAISHIN_ECOM: 'ENABLED' }).resolve(adapter.provider), code('PAYMENT_PROVIDER_ADAPTER_UNAVAILABLE')));
test('R04', 'existing-behavior', 'Duplicate provider adapters are rejected', () =>
  assert.throws(() => new Registry([adapter, adapter], {}), code('PAYMENT_PROVIDER_DUPLICATE')));
test('R05', 'runtime-input-hardening', 'Unknown runtime availability cannot resolve adapter', () =>
  assert.throws(() => new Registry([adapter], JSON.parse('{"TAISHIN_ECOM":"ENABELD"}')).resolve(adapter.provider)));
test('R06', 'existing-behavior', 'Explicit ENABLED resolves registered adapter', () =>
  assert.equal(new Registry([adapter], { TAISHIN_ECOM: 'ENABLED' }).resolve(adapter.provider), adapter));
const output = {
  auditedAt: new Date().toISOString(), sourceRef: snapshot.ref, node: process.version,
  execution: 'ISOLATED_HELPER_PROBES', sourceIntegrity: 'PASS', sourceHashes: hashes,
  transformation: 'Node stripTypeScriptTypes transform; exact type-only imports removed in memory; no repository runtime files edited',
  scope: 'No TypeScript typecheck, app build, database, HTTP ingress, provider mock/sandbox or production verification',
  interpretation: 'Boundary-proposal and runtime-input-hardening cases test requirements at the helper boundary; failures do not prove an exposed HTTP vulnerability. Integration may enforce these guards elsewhere, requiring separate evidence.',
  summary: { total: results.length, pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length },
  results,
};
fs.writeFileSync(path.join(here, 'probe-results.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ sourceRef: output.sourceRef, ...output.summary, failures: results.filter(x => x.status === 'FAIL').map(x => x.id) }));
process.exitCode = output.summary.fail ? 1 : 0;
