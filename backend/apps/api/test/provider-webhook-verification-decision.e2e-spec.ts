import { createHash } from 'node:crypto';
import {
  decideProviderWebhookVerification,
  PersistedWebhookVerification,
  ProviderWebhookVerificationDecision,
  ProviderWebhookVerificationEvidence,
} from '../src/modules/commerce/provider-webhook-verification-decision';

const payloadHash = createHash('sha256').update('provider-payload').digest('hex');
const evidence: ProviderWebhookVerificationEvidence = {
  verdict: 'VERIFIED', providerEventIdentity: 'event-20260918-1', payloadHash,
  signatureTimestamp: '2026-09-18T12:00:00Z', verifiedAt: '2026-09-18T12:00:02Z',
  safeEvidenceRef: 'vault://provider/evidence/event-1', verificationConfigVersion: 'stage-v3',
};
const base = {
  evidence, receivedAt: '2026-09-18T12:00:01Z', evaluatedAt: '2026-09-18T12:00:03Z',
  maxSignatureAgeSeconds: 300, maxFutureSkewSeconds: 30, existing: null,
};

function persisted(decision: ProviderWebhookVerificationDecision): PersistedWebhookVerification {
  return {
    providerEventIdentity: evidence.providerEventIdentity, payloadHash,
    verificationEvidenceHash: decision.verificationEvidenceHash,
    safeEvidenceRef: evidence.safeEvidenceRef, verificationConfigVersion: evidence.verificationConfigVersion,
    verifiedAt: evidence.verifiedAt,
  };
}

describe('Provider-neutral webhook verification decision', () => {
  it('accepts complete evidence from an official adapter without assuming its signature algorithm', () => {
    expect(decideProviderWebhookVerification(base)).toMatchObject({
      action: 'ACCEPT', providerEventIdentity: evidence.providerEventIdentity, payloadHash,
      verificationEvidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('fails closed when the adapter rejected signature verification', () => {
    expect(() => decideProviderWebhookVerification({ ...base, evidence: { ...evidence, verdict: 'REJECTED' } }))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_VERIFICATION_REJECTED' }));
  });

  it.each(['providerEventIdentity', 'safeEvidenceRef', 'verificationConfigVersion'] as const)(
    'fails closed when %s evidence is absent', field => {
      expect(() => decideProviderWebhookVerification({ ...base, evidence: { ...evidence, [field]: '' } }))
        .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_EVIDENCE_INCOMPLETE' }));
    });

  it('rejects malformed payload digest and non-canonical timestamps', () => {
    expect(() => decideProviderWebhookVerification({ ...base, evidence: { ...evidence, payloadHash: 'not-a-digest' } }))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_EVIDENCE_INCOMPLETE' }));
    expect(() => decideProviderWebhookVerification({ ...base, evidence: { ...evidence, signatureTimestamp: '2026-09-18 12:00:00' } }))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_TIMESTAMP_INVALID' }));
  });

  it('rejects expired signatures at receipt or delayed processing time', () => {
    expect(() => decideProviderWebhookVerification({ ...base, receivedAt: '2026-09-18T12:05:01Z' }))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_TIMESTAMP_EXPIRED' }));
    expect(() => decideProviderWebhookVerification({ ...base, evaluatedAt: '2026-09-18T12:05:01Z' }))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_TIMESTAMP_EXPIRED' }));
  });

  it('rejects signatures beyond the explicit future clock-skew allowance', () => {
    expect(() => decideProviderWebhookVerification({ ...base,
      evidence: { ...evidence, signatureTimestamp: '2026-09-18T12:00:32Z' } }))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_TIMESTAMP_IN_FUTURE' }));
  });

  it('returns a no-op only for an exact replay with complete persisted evidence', () => {
    const first = decideProviderWebhookVerification(base);
    expect(decideProviderWebhookVerification({ ...base, existing: persisted(first) }).action).toBe('NOOP_REPLAY');
  });

  it('keeps an exact durable replay idempotent after the live signature window', () => {
    const first = decideProviderWebhookVerification(base);
    expect(decideProviderWebhookVerification({
      ...base,
      evaluatedAt: '2026-09-19T12:00:03Z',
      existing: persisted(first),
    }).action).toBe('NOOP_REPLAY');
  });

  it.each(['payloadHash', 'safeEvidenceRef', 'verificationConfigVersion', 'verifiedAt'] as const)(
    'rejects replay when persisted %s differs', field => {
      const first = decideProviderWebhookVerification(base);
      const changed = field === 'payloadHash' ? 'a'.repeat(64)
        : field === 'verifiedAt' ? '2026-09-18T12:00:03Z' : 'different';
      expect(() => decideProviderWebhookVerification({ ...base,
        existing: { ...persisted(first), [field]: changed } }))
        .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_REPLAY_CONFLICT' }));
    });

  it('rejects incomplete persisted replay evidence', () => {
    const first = decideProviderWebhookVerification(base);
    expect(() => decideProviderWebhookVerification({ ...base,
      existing: { ...persisted(first), verificationEvidenceHash: '' } }))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_REPLAY_EVIDENCE_INCOMPLETE' }));
  });

  it('rejects implicit or invalid acceptance-window configuration', () => {
    expect(() => decideProviderWebhookVerification({ ...base, maxSignatureAgeSeconds: -1 }))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_WEBHOOK_EVIDENCE_INCOMPLETE' }));
  });
});
