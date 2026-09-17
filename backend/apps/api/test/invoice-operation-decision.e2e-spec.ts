import {
  decideInvoiceOperation,
  InvoiceOperationCommand,
  PersistedInvoiceOperationClaim,
} from '../src/modules/commerce/invoice-operation-decision.service';
import { ProviderRegistry } from '../src/modules/commerce/contracts/provider-registry';
import type { InvoiceProviderAdapter } from '../src/modules/commerce/contracts/invoice';

const issue: InvoiceOperationCommand = {
  invoiceId: 'invoice-1', orderId: 'order-1', provider: 'ECPAY', connectionVersionId: 'connection-v1',
  operationKind: 'ISSUE', operationId: 'issue-1', idempotencyKey: 'invoice-operation-1',
};

function completeClaim(operationHash: string): PersistedInvoiceOperationClaim {
  return { operationHash, invoiceEvidenceRef: 'invoice-evidence-1', providerEvidenceRef: 'provider-evidence-1', outboxIntentRef: 'outbox-1' };
}

describe('Invoice provider connection and operation claim contracts', () => {
  it('fails closed when a provider connection is pending, disabled, unsupported or lacks its adapter', () => {
    const adapter = { provider: 'ECPAY' } as InvoiceProviderAdapter;
    const supported = ['ECPAY', 'CHT_EINVOICE', 'OTHER'] as const;
    expect(() => new ProviderRegistry([adapter], { ECPAY: 'CONFIG_PENDING' }, supported).resolve('ECPAY'))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_CONFIG_PENDING' }));
    expect(() => new ProviderRegistry([adapter], {}, supported).resolve('ECPAY'))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_DISABLED' }));
    expect(() => new ProviderRegistry([], { ECPAY: 'ENABLED' }, supported).resolve('ECPAY'))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_ADAPTER_UNAVAILABLE' }));
    expect(() => new ProviderRegistry([], {}, supported).resolve('UNSUPPORTED' as never))
      .toThrow(expect.objectContaining({ code: 'PROVIDER_CONFIG_INVALID' }));
  });

  it('binds an invoice operation to a versioned provider connection', () => {
    const result = decideInvoiceOperation({ command: issue, existingClaim: null });
    expect(result).toMatchObject({ action: 'APPLY', canonicalCommand: { schemaVersion: 1, connectionVersionId: 'connection-v1' } });
    expect(result.operationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns a deterministic no-op only for a complete atomic claim', () => {
    const first = decideInvoiceOperation({ command: issue, existingClaim: null });
    expect(decideInvoiceOperation({ command: issue, existingClaim: completeClaim(first.operationHash) }).action).toBe('NOOP_REPLAY');
  });

  it.each(['invoiceEvidenceRef', 'providerEvidenceRef', 'outboxIntentRef'] as const)(
    'rejects replay when %s was not committed atomically', field => {
      const first = decideInvoiceOperation({ command: issue, existingClaim: null });
      expect(() => decideInvoiceOperation({
        command: issue,
        existingClaim: { ...completeClaim(first.operationHash), [field]: '' },
      })).toThrow(expect.objectContaining({ code: 'INVOICE_OPERATION_CLAIM_INCOMPLETE' }));
    },
  );

  it('rejects idempotency-key reuse with a different operation payload', () => {
    const first = decideInvoiceOperation({ command: issue, existingClaim: null });
    expect(() => decideInvoiceOperation({
      command: { ...issue, provider: 'CHT_EINVOICE' },
      existingClaim: completeClaim(first.operationHash),
    })).toThrow(expect.objectContaining({ code: 'INVOICE_OPERATION_CONFLICT' }));
  });

  it('requires versioned connection evidence and approval evidence for destructive operations', () => {
    expect(() => decideInvoiceOperation({ command: { ...issue, connectionVersionId: '' }, existingClaim: null }))
      .toThrow(expect.objectContaining({ code: 'INVOICE_OPERATION_CONTEXT_INVALID' }));
    for (const operationKind of ['VOID', 'ALLOWANCE'] as const) {
      expect(() => decideInvoiceOperation({ command: { ...issue, operationKind }, existingClaim: null }))
        .toThrow(expect.objectContaining({ code: 'INVOICE_OPERATION_CONTEXT_INVALID' }));
    }
  });

  it('keeps distinct partial allowances as distinct operations', () => {
    const allowance = { ...issue, operationKind: 'ALLOWANCE' as const, amount: '100.00', currency: 'TWD', approvalEvidenceId: 'approval-1' };
    const first = decideInvoiceOperation({ command: { ...allowance, operationId: 'allowance-1' }, existingClaim: null });
    const second = decideInvoiceOperation({ command: { ...allowance, operationId: 'allowance-2' }, existingClaim: null });
    expect(first.operationHash).not.toBe(second.operationHash);
  });
});
