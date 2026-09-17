import type { Id, CommandContext } from './common';
import type { VerifiedPaymentReceipt } from '../../payment-hub/payment-provider.adapter';
import type { RmaPostedEvidence } from './rma';
export type ReceivedRmaPostingInput = Readonly<{
  orderId: Id; rmaId: Id; status: 'RECEIVED'; receivedEvidenceRef: Id;
  coreApprovedPostingRef: Id; approvedAllocationRef: Id;
  lines: readonly Readonly<{ orderLineId: Id; quantity: string }>[];
}>;
/** Proposed ports only. Core owns wiring, atomic persistence, recognition and reversal.
 * No new Core event name or monetary semantics are introduced by these interfaces. */
export interface CoreCommerceEvidencePort {
  acceptVerifiedPayment(receipt: VerifiedPaymentReceipt, context: CommandContext): Promise<Readonly<{
    paymentEventId: Id; coreReceiptRef: Id;
    recognitionStatus: 'ACCEPTED_FOR_CORE_PROCESSING' | 'CONFIGURATION_PENDING';
  }>>;
  /** Core verifies RECEIVED evidence and its posting/allocation approval in its transaction.
   * Only the resulting POSTED boundary may trigger reversal/replay; APPROVED is insufficient. */
  postReceivedRmaAtCanonicalBoundary(input: ReceivedRmaPostingInput,
    context: CommandContext): Promise<RmaPostedEvidence>;
}
