import { createHash } from 'node:crypto';

export type InvoiceOperationKind = 'ISSUE' | 'VOID' | 'ALLOWANCE';

export type InvoiceOperationCommand = Readonly<{
  invoiceId: string;
  orderId: string;
  provider: string;
  connectionVersionId: string;
  operationKind: InvoiceOperationKind;
  operationId: string;
  idempotencyKey: string;
  amount?: string;
  currency?: string;
  approvalEvidenceId?: string;
}>;

export type PersistedInvoiceOperationClaim = Readonly<{
  operationHash: string;
  invoiceEvidenceRef: string;
  providerEvidenceRef: string;
  outboxIntentRef: string;
}>;

export type InvoiceOperationDecision = Readonly<{
  action: 'APPLY' | 'NOOP_REPLAY';
  operationHash: string;
  canonicalCommand: InvoiceOperationCommand & { schemaVersion: 1 };
}>;

export class InvoiceOperationDecisionError extends Error {
  constructor(
    readonly code: 'INVOICE_OPERATION_CONTEXT_INVALID' | 'INVOICE_OPERATION_CONFLICT' | 'INVOICE_OPERATION_CLAIM_INCOMPLETE',
    message: string,
  ) {
    super(message);
    this.name = 'InvoiceOperationDecisionError';
  }
}

/** Pure fail-closed decision boundary. The persistence owner must create the
 * claim, invoice/provider evidence and transactional outbox intent atomically. */
export function decideInvoiceOperation(input: {
  command: InvoiceOperationCommand;
  existingClaim: PersistedInvoiceOperationClaim | null;
}): InvoiceOperationDecision {
  const canonicalCommand = canonicalize(input.command);
  const operationHash = createHash('sha256').update(stableJson(canonicalCommand)).digest('hex');
  if (input.existingClaim !== null) {
    assertCompleteClaim(input.existingClaim);
    if (input.existingClaim.operationHash !== operationHash) {
      throw new InvoiceOperationDecisionError(
        'INVOICE_OPERATION_CONFLICT',
        'The idempotency key is already bound to another invoice operation.',
      );
    }
    return Object.freeze({ action: 'NOOP_REPLAY', operationHash, canonicalCommand });
  }
  return Object.freeze({ action: 'APPLY', operationHash, canonicalCommand });
}

function canonicalize(command: InvoiceOperationCommand): InvoiceOperationDecision['canonicalCommand'] {
  if (!['ISSUE', 'VOID', 'ALLOWANCE'].includes(command.operationKind)) invalid();
  const result = {
    schemaVersion: 1 as const,
    invoiceId: required(command.invoiceId),
    orderId: required(command.orderId),
    provider: required(command.provider),
    connectionVersionId: required(command.connectionVersionId),
    operationKind: command.operationKind,
    operationId: required(command.operationId),
    idempotencyKey: required(command.idempotencyKey),
    ...(command.amount === undefined ? {} : { amount: required(command.amount) }),
    ...(command.currency === undefined ? {} : { currency: required(command.currency) }),
    ...(command.approvalEvidenceId === undefined ? {} : { approvalEvidenceId: required(command.approvalEvidenceId) }),
  };
  if (command.operationKind === 'ALLOWANCE' && (result.amount === undefined || result.currency === undefined)) invalid();
  if ((command.operationKind === 'VOID' || command.operationKind === 'ALLOWANCE') && result.approvalEvidenceId === undefined) invalid();
  return Object.freeze(result);
}

function assertCompleteClaim(claim: PersistedInvoiceOperationClaim): void {
  if (!claim || [claim.operationHash, claim.invoiceEvidenceRef, claim.providerEvidenceRef, claim.outboxIntentRef]
    .some(value => typeof value !== 'string' || !value.trim())) {
    throw new InvoiceOperationDecisionError(
      'INVOICE_OPERATION_CLAIM_INCOMPLETE',
      'Persisted invoice operation claim is missing invoice, provider or outbox evidence.',
    );
  }
}

function required(value: string): string {
  const normalized = value?.trim();
  if (!normalized) invalid();
  return normalized;
}

function invalid(): never {
  throw new InvoiceOperationDecisionError('INVOICE_OPERATION_CONTEXT_INVALID', 'Invoice operation context is incomplete or invalid.');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
