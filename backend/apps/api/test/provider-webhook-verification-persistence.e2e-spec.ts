import { createHash } from 'node:crypto';
import {
  ProviderWebhookVerificationPersistenceService,
} from '../src/modules/commerce/provider-webhook-verification-persistence.service';
import type { ProviderWebhookVerificationEvidence } from '../src/modules/commerce/provider-webhook-verification-decision';

const inboxId = '00000000-0000-4000-8000-000000000041';
const payloadHash = createHash('sha256').update('callback').digest('hex');
const evidence: ProviderWebhookVerificationEvidence = {
  verdict: 'VERIFIED', providerEventIdentity: 'evt-41', payloadHash,
  signatureTimestamp: '2026-09-18T12:00:00.000Z', verifiedAt: '2026-09-18T12:00:01.000Z',
  safeEvidenceRef: 'vault://provider/webhook/41', verificationConfigVersion: 'stage-v1',
};

function fixture() {
  const row: any = {
    providerWebhookInboxId: inboxId, payloadHash, safeEvidenceRef: evidence.safeEvidenceRef,
    verificationConfigVersion: evidence.verificationConfigVersion, providerEventIdentity: null,
    verificationEvidenceHash: null, signatureTimestamp: null, verifiedAt: null,
    receivedAt: new Date('2026-09-18T12:00:02.000Z'), status: 'RECEIVED', lastErrorCode: null,
  };
  const updateMany = jest.fn(async ({ where, data }: any) => {
    if (row.providerWebhookInboxId !== where.providerWebhookInboxId || row.status !== where.status) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  });
  const tx: any = { providerWebhookInbox: {
    findUnique: jest.fn(async () => ({ ...row })), updateMany,
  } };
  const db: any = { $transaction: jest.fn(async (work: any) => work(tx)) };
  return { row, updateMany, service: new ProviderWebhookVerificationPersistenceService(db) };
}

const input = (value = evidence) => ({
  providerWebhookInboxId: inboxId, evidence: value,
  evaluatedAt: '2026-09-18T12:00:03.000Z', maxSignatureAgeSeconds: 300, maxFutureSkewSeconds: 30,
});

describe('Provider webhook verification persistence', () => {
  it('atomically persists complete VERIFIED evidence without raw signature material', async () => {
    const { service, row, updateMany } = fixture();
    await expect(service.persist(input())).resolves.toMatchObject({ action: 'ACCEPT', status: 'VERIFIED' });
    expect(row).toMatchObject({ status: 'VERIFIED', providerEventIdentity: 'evt-41', lastErrorCode: null });
    expect(row.verificationEvidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(updateMany.mock.calls[0][0].data).not.toHaveProperty('rawBody');
  });

  it('returns an idempotent no-op for exact VERIFIED redelivery', async () => {
    const { service, updateMany } = fixture();
    await service.persist(input());
    await expect(service.persist(input())).resolves.toMatchObject({ action: 'NOOP_REPLAY', status: 'VERIFIED' });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('fails closed when a verified event identity is replayed with changed payload evidence', async () => {
    const { service, updateMany } = fixture();
    await service.persist(input());
    const changed = { ...evidence, payloadHash: createHash('sha256').update('changed').digest('hex') };
    await expect(service.persist(input(changed))).rejects.toMatchObject({ code: 'PROVIDER_WEBHOOK_REPLAY_CONFLICT' });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('persists REJECTED evidence as a terminal fail-closed result and no-ops exact replay', async () => {
    const { service, row, updateMany } = fixture();
    const rejected = { ...evidence, verdict: 'REJECTED' as const };
    await expect(service.persist(input(rejected))).resolves.toMatchObject({ action: 'REJECT', status: 'REJECTED' });
    expect(row).toMatchObject({
      status: 'REJECTED', providerEventIdentity: null,
      lastErrorCode: 'PROVIDER_WEBHOOK_VERIFICATION_REJECTED',
    });
    await expect(service.persist(input(rejected))).resolves.toMatchObject({ action: 'NOOP_REPLAY', status: 'REJECTED' });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects changed evidence after a terminal rejection', async () => {
    const { service } = fixture();
    const rejected = { ...evidence, verdict: 'REJECTED' as const };
    await service.persist(input(rejected));
    await expect(service.persist(input({ ...rejected, providerEventIdentity: 'evt-other' })))
      .rejects.toMatchObject({ code: 'PROVIDER_WEBHOOK_REPLAY_CONFLICT' });
  });

  it('does not let a rejected replay replace already verified evidence', async () => {
    const { service } = fixture();
    await service.persist(input());
    await expect(service.persist(input({ ...evidence, verdict: 'REJECTED' })))
      .rejects.toMatchObject({ code: 'PROVIDER_WEBHOOK_REPLAY_CONFLICT' });
  });

  it('rolls back without persistence when evidence timestamps are invalid or expired', async () => {
    const { service, updateMany } = fixture();
    await expect(service.persist(input({ ...evidence, signatureTimestamp: '2026-09-18T11:00:00.000Z' })))
      .rejects.toMatchObject({ code: 'PROVIDER_WEBHOOK_TIMESTAMP_EXPIRED' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('fails closed when concurrent status change defeats the compare-and-set update', async () => {
    const { service, updateMany } = fixture();
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.persist(input())).rejects.toMatchObject({ code: 'PROVIDER_WEBHOOK_STATUS_CONFLICT' });
  });

  it('does not accept verification evidence that differs from durable ingress metadata', async () => {
    const { service, updateMany } = fixture();
    await expect(service.persist(input({ ...evidence, safeEvidenceRef: 'vault://other' })))
      .rejects.toMatchObject({ code: 'PROVIDER_WEBHOOK_INGRESS_EVIDENCE_CONFLICT' });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
