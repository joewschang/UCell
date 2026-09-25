# R1.0B Onboarding and Retail Referral Gap Re-Audit

**Status date:** 2026-09-25 (Asia/Taipei)
**Baseline:** `a02b62e5f843cc3d59645033ea49f9e07e005aa6`
**Authority:** R1.0B Member Onboarding/Paper/LINE Link spec; approved Paper Order/Receipt/Company Sponsor decision; P0 privacy decision.
A slice is `COMPLETE` only when the required DB, domain, API, runtime, relevant UI, security/audit and test evidence are all present. No status below treats an unverified surface as closed.

| Vertical slice | Status | Re-audit evidence / remaining closure work |
|---|---|---|
| WEB_MEMBER retail order and delivery profile | PARTIAL | `commerce.order` supports zero-Ball purchaser orders; Member checkout and delivery requirement test exist. Payment/fulfilment E2E remains open. |
| Qualification package / acquisition | PARTIAL | Versioned package path and sponsor candidate validation exist. Complete acquisition read model and E2E activation evidence remain open. |
| SponsorResolver for Ball codes | PARTIAL | Shared Ball resolver and online/paper candidate handling exist; full eligibility and package evidence parity need Golden coverage. |
| Referral deep link / LINE preservation | PARTIAL | Candidate is non-binding and survives current LINE path. QR UI and redirect E2E remain open. |
| Payment → placement pending | PARTIAL | Sponsored package creates `PLACEMENT_PENDING`; complete payment, reversal and activation E2E is not yet demonstrated. |
| Sponsor pending-placement workbench | COMPLETE | Member-safe queue and placement workbench now use public Ball numbers only. Sponsor authorization, slot/cycle/first-third-left validation and idempotency remain server-authoritative; Admin retains its separately RBAC-protected UUID command surface. |
| Placement → activation | PARTIAL | Authoritative placement service, idempotency and slot race coverage exist. Onboarding E2E activation remains open. |
| Paper application / duplicate Person | PARTIAL | Paper sponsor input enters shared resolver. Approved duplicate workflow, wizard and paper provenance closure are absent. |
| Paper order | MISSING | No approved `ADMIN_PAPER_ORDER` source/channel implementation was found. |
| Paper receipt / payment confirmation | COMPLETE | Receipt evidence identity is immutable and retry-safe; conflicting evidence fails closed, dual control is enforced, and pre-placement reversal is covered. |
| Company Sponsor Alias v1 | COMPLETE | Effective-dated, audited Company Alias resolution is available for qualifying acquisition and paper intake; member views expose only governed display information. |
| Existing Member LINE link | PARTIAL | Verified subject request, hashed one-time completion token, queue and focused fail-closed tests exist. Self-approval/rebind boundary and full Paper→LINE E2E remain open. |
| Retail attribution | PARTIAL | Temporal attribution, first-order lock, forward correction, snapshots, audit/outbox exist. DB concurrency and historical correction Golden remain open. |
| Retail checkout UX | PARTIAL | Candidate edit/clear/validation before first lock and locked display exist. Checkout/paid order UX and complete order history remain open. |
| SKU retail referral parameters | PARTIAL | Effective-dated profile fields and product UI exist. Effective-version/history Golden and approval workflow remain open. |
| Retail Active eligibility | PARTIAL | Worker evaluates recognition-time active evidence. Historical active/replay Golden remains open. |
| RETAIL_REFERRAL award | PARTIAL | Immutable snapshot recognition has active and inactive DB integration evidence; settlement/payout and explain are open. |
| Retail return / recovery | PARTIAL | Partial return uses append-only offset recovery and retry evidence. Full, repeated, paid-award recovery and replay Golden are open. |
| Operations explain / notifications | PARTIAL | Attribution history exists. Retail award explain, paper receipt/payment, pending placement and safe notifications are open. |
| P0 privacy / identifiers | COMPLETE | Member projection hides bootstrap Company Balls and Reservoir data, prevents non-direct holder PII disclosure, and uses business identifiers in normal flows. Pending placement is additionally covered by Ball-number-only regression. |
| OpenAPI / contracts | COMPLETE | `backend/openapi.generated.json` is regenerated for the current API and OpenAPI preflight passes. Existing operations remain governed by the generated artifact. |

## Preserved Retail Referral invariants

- Inactive referrer recognition preserves theory, records `payableAmount = 0`, and creates no PV, Binary or organization effect.
- Partial return preserves the original Award and appends one idempotent recovery effect.
- Retail attribution is independent of Sponsor and Binary relationships.
- Retail referral does not itself create GPV, PV, RPV, EPV, Binary, Sponsor or organization effects.

## Implementation sequence

1. Implement Company Sponsor Alias v1 and Paper receipt/order core through existing Order, Payment, SponsorResolver and Placement authorities.
2. Add Paper wizard/operations read models and complete Payment → Placement → Activation and Paper → LINE E2E evidence.
3. Finish Retail Referral Golden coverage: effective SKU history, active history, full/multiple/paid return, settlement/payout, replay and explain.
4. Regenerate OpenAPI, execute full gates and complete closure reports.

## Explicit constraints

- No historical migration is edited; schema work is forward-only.
- Semantic DB, Analytics, LLM/RAG/Vector DB and deployment are outside this closure.
- Google Drive is not modified without explicitly authorized Drive tooling; any final closure must remain `CODE_CLOSED_DRIVE_SYNC_PENDING` until synchronized.
