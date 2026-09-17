import type { Id, Timestamp, Money, CommandContext, SafeEvidenceRef, ProviderResult, ProviderContext, UntrustedWebhook, Verified, Verification } from './common';


import type { VerifiedPaymentReceipt } from '../../payment-hub/payment-provider.adapter';
import type { RmaPostedEvidence } from './rma';
/** Proposed ports only. Core owns wiring, atomic persistence, recognition and reversal.
 * No new Core event name or monetary semantics are introduced by these interfaces. */
export interface CoreCommerceEvidencePort {
  acceptVerifiedPayment(receipt: VerifiedPaymentReceipt, context: CommandContext): Promise<Readonly<{
    paymentEventId: Id; coreReceiptRef: Id;
    recognitionStatus: 'ACCEPTED_FOR_CORE_PROCESSING' | 'CONFIGURATION_PENDING';
  }>>;
  postApprovedRma(input: Readonly<{ orderId: Id; rmaId: Id; approvedAllocationRef: Id;
    receiptEvidenceId: Id; lines: readonly Readonly<{ orderLineId: Id; quantity: string }>[] }>,
    context: CommandContext): Promise<RmaPostedEvidence>;
}
