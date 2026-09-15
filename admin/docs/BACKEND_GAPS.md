# Backend/API Gaps Blocking Full Admin UX

Admin v0.1.0 is intentionally honest about backend gaps.

## RC / Production blockers
- Production Admin authentication is not yet enforced consistently.
- Entra/JWT and LINE official token verification are not complete.
- PAYABLE → PAID execution/reconciliation API is incomplete.
- Dependency-backed Prisma/TypeScript/PostgreSQL RC gate is still pending.

## Read-model gaps
The backend currently focuses on command/core-engine APIs. Full Admin UX needs list/search/read-model endpoints for:
- membership application queue
- qualification list/search
- order list/search
- return case queue
- workflow queue
- payout batches/history
- audit event search
- dashboard aggregates
- settlement/replay history

v0.1.0 therefore uses ID-oriented Workbench screens instead of inventing fake data.

## Later operational gaps
- Referral share attribution model/API
- Attachments/original forms
- Fulfillment/Lot/Serial/Shipment
- D365 External Reference/Inbox
- Full hierarchical Rule Registry
- Reporting / Integrity Alerts
