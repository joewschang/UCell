import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { randomUUID } from 'node:crypto';
import {
  decideProviderEventApplication,
  deriveProviderOperationIdentity,
  PaymentBinding,
  PersistedPaymentOperationClaim,
  ProviderEventApplicationDecision,
  ProviderEventDecisionError,
} from './provider-event-decision';
import { CanonicalProviderEventInput, canonicalizeProviderEvent } from './provider-event-canonicalizer';
import { VerifiedPaymentReceipt, assertIssuedPaymentReceipt } from './payment-provider.adapter';

type Db = Prisma.TransactionClient;

export type PersistVerifiedProviderEventInput = Readonly<{
  event: CanonicalProviderEventInput;
  receipt: VerifiedPaymentReceipt;
  correlationId: string;
}>;

export type PersistVerifiedProviderEventResult = Readonly<{
  action: ProviderEventApplicationDecision['action'];
  paymentId: string;
  status: string;
  providerEventEvidenceId: string | null;
  paymentStateTransitionId: string;
  outboxEventId: string;
  operationClaimId: string;
}>;

export class PaymentPersistenceError extends Error {
  constructor(readonly code:
    | 'PAYMENT_NOT_FOUND'
    | 'PAYMENT_BINDING_INCOMPLETE'
    | 'PAYMENT_EVENT_ORPHANED'
    | 'PAYMENT_OPERATION_INCOMPLETE'
    | 'PAYMENT_PERSISTENCE_CONFLICT', message: string) {
    super(message);
    this.name = 'PaymentPersistenceError';
  }
}

/** Core-owned persistence boundary. Provider adapters must issue a branded receipt before
 * entering this service. A browser return or caller-built JSON object cannot reach storage. */
@Injectable()
export class PaymentPersistenceService {
  constructor(private readonly db: PrismaService) {}

  async persist(input: PersistVerifiedProviderEventInput): Promise<PersistVerifiedProviderEventResult> {
    assertIssuedPaymentReceipt(input.receipt);
    assertUuid(input.correlationId, 'correlationId');
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await this.db.$transaction(tx => this.persistInTransaction(tx, input), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
        });
      } catch (error) {
        lastError = error;
        if (!isRetryableTransactionConflict(error) || attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 10));
      }
    }
    throw lastError;
  }

  private async persistInTransaction(tx: Db, input: PersistVerifiedProviderEventInput): Promise<PersistVerifiedProviderEventResult> {
    const receipt = input.receipt;
    // Row locking makes the mutable projection and its append-only history one serial stream.
    await tx.$queryRaw`SELECT payment_id FROM commerce.payment WHERE payment_id = ${receipt.paymentId}::uuid FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { paymentId: receipt.paymentId } });
    if (!payment) throw new PaymentPersistenceError('PAYMENT_NOT_FOUND', 'The bound payment does not exist.');
    if (!payment.providerTransactionRef) {
      throw new PaymentPersistenceError('PAYMENT_BINDING_INCOMPLETE', 'Provider transaction binding must be persisted before outcome ingestion.');
    }
    const binding: PaymentBinding = {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      provider: payment.provider,
      connectionId: payment.connectionId,
      providerTransactionRef: payment.providerTransactionRef,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
    };
    const canonical = canonicalizeProviderEvent(input.event);
    const existingEvidence = await tx.paymentProviderEventEvidence.findUnique({
      where: { provider_connectionId_providerEventIdentity: {
        provider: canonical.provider,
        connectionId: receipt.connectionId,
        providerEventIdentity: canonical.providerEventIdentity,
      } },
    });
    if (existingEvidence && existingEvidence.paymentId !== payment.paymentId) {
      throw new PaymentPersistenceError('PAYMENT_EVENT_ORPHANED', 'Provider event identity belongs to another payment.');
    }

    const operationIdentity = deriveProviderOperationIdentity(receipt);
    const claimRow = await tx.paymentOperationClaim.findUnique({
      where: { businessEffectIdentity: operationIdentity.businessEffectIdentity },
      include: { stateTransition: { include: { providerEvidence: true } }, outboxEvent: true },
    });
    const claim = claimRow ? this.toCommittedClaim(claimRow, payment.paymentId) : null;
    const decision = decideProviderEventApplication({
      currentStatus: payment.status,
      binding,
      existingPayloadHash: existingEvidence?.payloadHash ?? null,
      existingOperationClaim: claim,
      event: input.event,
      evidence: { receipt },
    });

    if (decision.action !== 'APPLY') {
      if (!claimRow) throw new PaymentPersistenceError('PAYMENT_OPERATION_INCOMPLETE', 'Replay has no complete committed operation.');
      if (decision.action === 'NOOP_REPLAY'
        && claimRow.stateTransition.paymentProviderEventEvidenceId !== existingEvidence?.paymentProviderEventEvidenceId) {
        throw new PaymentPersistenceError('PAYMENT_EVENT_ORPHANED', 'Replay evidence is not the evidence committed by the operation.');
      }
      return this.result(decision.action, payment.paymentId, payment.status, existingEvidence?.paymentProviderEventEvidenceId ?? null, claimRow);
    }

    const evidence = await tx.paymentProviderEventEvidence.create({ data: {
      paymentId: payment.paymentId,
      provider: canonical.provider,
      connectionId: receipt.connectionId,
      providerEventIdentity: canonical.providerEventIdentity,
      providerTransactionRef: canonical.providerTransactionRef,
      source: canonical.source,
      payloadHash: canonical.payloadHash,
      safeEvidenceRef: receipt.safeEvidenceRef,
      verificationConfigVersion: receipt.verificationConfigVersion,
      verifiedAt: new Date(receipt.verifiedAt),
      receivedAt: new Date(),
      correlationId: input.correlationId,
    } });
    const transition = await tx.paymentStateTransition.create({ data: {
      paymentId: payment.paymentId,
      paymentProviderEventEvidenceId: evidence.paymentProviderEventEvidenceId,
      fromStatus: payment.status,
      toStatus: decision.nextStatus,
      amount: new Prisma.Decimal(receipt.amount),
      currency: receipt.currency,
      businessEffectIdentity: decision.businessEffectIdentity,
      operationHash: decision.operationHash,
      occurredAt: canonical.occurredAt ? new Date(canonical.occurredAt) : new Date(receipt.verifiedAt),
      correlationId: input.correlationId,
    } });
    const outbox = await tx.outboxEvent.create({ data: {
      eventType: 'PAYMENT_STATE_TRANSITIONED',
      aggregateType: 'Payment',
      aggregateId: payment.paymentId,
      correlationId: input.correlationId,
      payload: {
        schemaVersion: 1,
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        fromStatus: payment.status,
        toStatus: decision.nextStatus,
        paymentStateTransitionId: transition.paymentStateTransitionId,
        providerEventEvidenceId: evidence.paymentProviderEventEvidenceId,
        businessEffectIdentity: decision.businessEffectIdentity,
        operationHash: decision.operationHash,
      },
    } });
    const claimRowCreated = await tx.paymentOperationClaim.create({ data: {
      paymentId: payment.paymentId,
      businessEffectIdentity: decision.businessEffectIdentity,
      operationHash: decision.operationHash,
      committedEffectRef: `payment-state-transition:${transition.paymentStateTransitionId}`,
      paymentStateTransitionId: transition.paymentStateTransitionId,
      outboxEventId: outbox.outboxEventId,
    }, include: { stateTransition: { include: { providerEvidence: true } }, outboxEvent: true } });
    await tx.payment.update({ where: { paymentId: payment.paymentId }, data: {
      status: decision.nextStatus,
      paidAt: decision.nextStatus === 'PAID' ? new Date(receipt.verifiedAt) : payment.paidAt,
    } });
    return this.result('APPLY', payment.paymentId, decision.nextStatus, evidence.paymentProviderEventEvidenceId, claimRowCreated);
  }

  private toCommittedClaim(row: any, paymentId: string): PersistedPaymentOperationClaim {
    const payload = row.outboxEvent?.payload;
    if (row.paymentId !== paymentId || !row.stateTransition || !row.outboxEvent
      || row.stateTransition.paymentId !== paymentId || row.outboxEvent.aggregateId !== paymentId
      || row.outboxEvent.eventType !== 'PAYMENT_STATE_TRANSITIONED'
      || row.paymentStateTransitionId !== row.stateTransition.paymentStateTransitionId
      || row.outboxEventId !== row.outboxEvent.outboxEventId
      || row.stateTransition.businessEffectIdentity !== row.businessEffectIdentity
      || row.stateTransition.operationHash !== row.operationHash
      || row.committedEffectRef !== `payment-state-transition:${row.paymentStateTransitionId}`
      || !row.stateTransition.providerEvidence
      || row.stateTransition.providerEvidence.paymentId !== paymentId
      || typeof payload !== 'object' || payload === null || Array.isArray(payload)
      || payload.paymentId !== paymentId
      || payload.paymentStateTransitionId !== row.paymentStateTransitionId
      || payload.providerEventEvidenceId !== row.stateTransition.paymentProviderEventEvidenceId
      || payload.businessEffectIdentity !== row.businessEffectIdentity
      || payload.operationHash !== row.operationHash) {
      throw new PaymentPersistenceError('PAYMENT_OPERATION_INCOMPLETE', 'Operation claim references are incomplete or inconsistent.');
    }
    return { integrity: 'COMMITTED', businessEffectIdentity: row.businessEffectIdentity, operationHash: row.operationHash,
      committedEffectRef: row.committedEffectRef,
      paymentStateEvidenceRef: row.paymentStateTransitionId,
      outboxIntentRef: row.outboxEventId };
  }

  private result(action: ProviderEventApplicationDecision['action'], paymentId: string, status: string,
    evidenceId: string | null, claim: any): PersistVerifiedProviderEventResult {
    return Object.freeze({ action, paymentId, status, providerEventEvidenceId: evidenceId,
      paymentStateTransitionId: claim.paymentStateTransitionId,
      outboxEventId: claim.outboxEventId,
      operationClaimId: claim.paymentOperationClaimId });
  }
}

function isRetryableTransactionConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && ('code' in error && (error as { code?: unknown }).code === 'P2034'
      || 'message' in error && /(?:40001|could not serialize access)/i.test(String((error as { message?: unknown }).message)));
}

function assertUuid(value: string, field: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new PaymentPersistenceError('PAYMENT_PERSISTENCE_CONFLICT', `${field} must be a UUID.`);
  }
}
