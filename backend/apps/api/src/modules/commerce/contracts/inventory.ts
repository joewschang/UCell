import type { Id, Timestamp, Money, CommandContext, SafeEvidenceRef, ProviderResult, ProviderContext, UntrustedWebhook, Verified, Verification } from './common';

export type TrackingMode = 'NONE' | 'LOT' | 'SERIAL' | 'LOT_SERIAL';
export interface InventoryPort {
  reserve(input: Readonly<{ orderId: Id; paidEvidenceId: Id; warehouseId: Id;
    lines: readonly Readonly<{ orderLineId: Id; itemId: Id; quantity: number }>[];
    policyVersion: string }>, context: CommandContext): Promise<Readonly<{
      reservationId: Id; status: 'RESERVED'; movementIds: readonly Id[];
    }>>;
  release(input: Readonly<{ reservationId: Id; reasonCode: string }>, context: CommandContext): Promise<void>;
  returnPosted(input: Readonly<{ rmaId: Id; returnCaseId: Id; postingEvidenceId: Id }>,
    context: CommandContext): Promise<Readonly<{ movementIds: readonly Id[] }>>;
}
