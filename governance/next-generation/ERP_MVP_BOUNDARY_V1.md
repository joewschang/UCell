# UCell ↔ ERP Boundary v1

Status: APPROVED ARCHITECTURAL BOUNDARY FOR MVP

UCell owns:
- Person/memberNo, Qualification/Ball/ballNo, Sponsor/Binary/Active.
- Member/Admin commerce intake and UCell order facts.
- R1.0B economics, Awards, Settlement/Recovery.
- Retail Referral and UCell Return/Replay economic consequences.
- ERP handoff fact and external reference.

ERP (initially candidate EzTooL) owns after handoff:
- physical inventory;
- picking/packing;
- shipment/logistics;
- invoice execution;
- accounting/financial books;
- physical return receiving/warehouse operations.

Phase 1:
UCell Order → governed ERP Adapter/API → external order ID (e.g. OrderEZID) → ERP_TRANSFERRED.
No requirement for real-time reverse integration.

Phase 1.5 optional:
governed CSV/Excel import for shipment/tracking/return/invoice status with Preview → Validate → Commit, import batch/hash/audit, dataThrough/freshness and truthSource=EXTERNAL_IMPORTED.

Critical semantics:
- ERP_TRANSFER_SUCCESS does not mean shipped/invoiced.
- no reverse data means UNKNOWN, not not-shipped.
- UCell Return POSTED/economic replay requires authoritative UCell confirmation/event; do not infer from missing ERP data.
- no direct ERP DB write.
- future DB read, if ever approved, must be read-only/integration-view based and behind adapter.
- UCell Core must remain ERP-vendor independent.
