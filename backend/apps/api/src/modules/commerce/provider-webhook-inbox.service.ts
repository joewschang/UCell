import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash } from 'node:crypto';

export type ProviderIntegrationDomain = 'PAYMENT' | 'INVOICE' | 'LOGISTICS';

export type ReceiveProviderWebhookInput = Readonly<{
  domain: ProviderIntegrationDomain;
  provider: string;
  connectionId: string;
  rawBody: Uint8Array;
  safeEvidenceRef: string;
  verificationConfigVersion: string;
  correlationId: string;
}>;

/** Durable ingress metadata only. Raw webhook bytes are hashed in memory and are never
 * persisted or returned. Domain effects remain unavailable until an official adapter
 * verifies the provider event and issues its trusted receipt. */
@Injectable()
export class ProviderWebhookInboxService {
  constructor(private readonly db: PrismaService) {}

  async receive(input: ReceiveProviderWebhookInput) {
    assertToken(input.provider, 'provider');
    assertToken(input.connectionId, 'connectionId');
    assertToken(input.safeEvidenceRef, 'safeEvidenceRef');
    assertToken(input.verificationConfigVersion, 'verificationConfigVersion');
    assertUuid(input.correlationId, 'correlationId');
    if (!(input.rawBody instanceof Uint8Array) || input.rawBody.byteLength === 0) throw new Error('PROVIDER_WEBHOOK_BODY_REQUIRED');
    const payloadHash = sha256(input.rawBody);
    const ingressKey = sha256(Buffer.from(`${input.domain}\n${input.provider}\n${input.connectionId}\n${payloadHash}`, 'utf8'));
    return this.db.providerWebhookInbox.upsert({
      where: { domain_provider_connectionId_ingressKey: {
        domain: input.domain,
        provider: input.provider,
        connectionId: input.connectionId,
        ingressKey,
      } },
      update: {},
      create: {
        domain: input.domain,
        provider: input.provider,
        connectionId: input.connectionId,
        ingressKey,
        payloadHash,
        safeEvidenceRef: input.safeEvidenceRef,
        verificationConfigVersion: input.verificationConfigVersion,
        correlationId: input.correlationId,
      },
      select: {
        providerWebhookInboxId: true,
        domain: true,
        provider: true,
        connectionId: true,
        ingressKey: true,
        payloadHash: true,
        status: true,
        receivedAt: true,
        correlationId: true,
      },
    });
  }
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertToken(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) throw new Error(`PROVIDER_WEBHOOK_${field.toUpperCase()}_INVALID`);
}

function assertUuid(value: string, field: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`PROVIDER_WEBHOOK_${field.toUpperCase()}_INVALID`);
  }
}
