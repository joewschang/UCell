import type { Id, Timestamp, Money, CommandContext, SafeEvidenceRef, ProviderResult, ProviderContext, UntrustedWebhook, Verified, Verification } from './common';

export type InvoiceStatus = 'REQUESTED' | 'ISSUED' | 'VOIDED' | 'ALLOWANCE_PENDING' | 'ALLOWANCE_ISSUED' | 'FAILED';
export type InvoiceProviderCode = 'ECPAY' | 'CHT_EINVOICE' | 'OTHER';
export type InvoiceFact = Readonly<{
  invoiceId: Id; providerRef: string; eventIdentity: string; status: InvoiceStatus;
  invoiceNumber?: string; occurredAt: Timestamp; rawStatusCode: string;
}>;
export interface InvoiceProviderAdapter {
  readonly provider: InvoiceProviderCode;
  issueInvoice(input: Readonly<{ invoiceId: Id; orderId: Id; buyerSnapshotRef: Id;
    taxSnapshotRef: Id; policyVersion: string }>, context: CommandContext): Promise<ProviderResult<Verified<InvoiceFact>>>;
  voidInvoice(input: Readonly<{ invoiceId: Id; providerRef: string; reasonCode: string; approvalEvidenceId: Id }>,
    context: CommandContext): Promise<ProviderResult<Verified<InvoiceFact>>>;
  issueAllowance(input: Readonly<{ invoiceId: Id; allowanceId: Id; providerRef: string;
    approvedAmount: Money; postingEvidenceId: Id; approvalEvidenceId: Id }>,
    context: CommandContext): Promise<ProviderResult<Verified<InvoiceFact>>>;
  queryInvoice(input: Readonly<{ invoiceId: Id; providerRef: string }>,
    context: CommandContext): Promise<ProviderResult<Verified<InvoiceFact>>>;
  verifyCallback(input: UntrustedWebhook, context: ProviderContext): Promise<Verification<InvoiceFact>>;
}
