import type { Id, Timestamp, Money, CommandContext, SafeEvidenceRef, ProviderResult, ProviderContext, UntrustedWebhook, Verified, Verification } from './common';

export type ErpDomain = 'ITEM' | 'INVENTORY' | 'ORDER' | 'SHIPMENT' | 'INVOICE' | 'ACCOUNTING';
export type ErpSyncRequest = Readonly<{
  outboxId: Id; entityId: Id; entityType: string; payloadVersion: number;
  immutableSnapshotRef: Id; externalMappingRef?: Id; connectionVersion: string;
}>;
export type ErpSyncReceipt = Readonly<{
  externalId: string; externalVersion?: string; evidence: SafeEvidenceRef;
}>;
export interface ErpAdapter {
  readonly provider: 'DYNAMICS_365_BC';
  syncItem(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  syncCustomerReference(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  syncOrder(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  syncShipment(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  syncInvoice(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  reconcile(input: Readonly<{ domain: ErpDomain; sourceWatermark: string; cursor?: string }>,
    context: CommandContext): Promise<ProviderResult<Readonly<{
      status: 'MATCHED' | 'MISMATCH' | 'INCOMPLETE'; evidence: SafeEvidenceRef; nextCursor?: string;
    }>>>;
}
export type ErpMode = Readonly<{ provider: 'NONE'; inventoryAuthority: 'UCELL'; adapter?: never }>
  | Readonly<{ provider: 'DYNAMICS_365_BC'; adapter: ErpAdapter; connectionVersion: string;
      approvedDomainAuthorities: Readonly<Partial<Record<ErpDomain, 'UCELL' | 'BC'>>> }>;

export function erpDisabled(): ErpMode { return Object.freeze({ provider: 'NONE', inventoryAuthority: 'UCELL' }); }
