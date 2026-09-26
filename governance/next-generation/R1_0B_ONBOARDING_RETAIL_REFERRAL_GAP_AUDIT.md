# R1.0B Onboarding and Retail Referral Gap Re-Audit

**Status date:** 2026-09-26 (Asia/Taipei)
**Baseline:** `a02b62e5f843cc3d59645033ea49f9e07e005aa6`
**Authority:** R1.0B Member Onboarding/Paper/LINE Link spec; approved Paper Order/Receipt/Company Sponsor decision; P0 privacy decision.
A slice is `COMPLETE` only when the required DB, domain, API, runtime, relevant UI, security/audit and test evidence are all present. No status below treats an unverified surface as closed.

| Vertical slice | Status | Re-audit evidence / remaining closure work |
|---|---|---|
| WEB_MEMBER retail order and delivery profile | PARTIAL | Zero-Ball checkout enforces a current delivery profile and records immutable product/referral snapshots. Paid-order history and governed fulfilment handoff require the remaining end-to-end evidence. |
| Qualification package / acquisition | PARTIAL | Versioned package path and sponsor candidate validation exist. Complete acquisition read model and E2E activation evidence remain open. |
| SponsorResolver for Ball codes | PARTIAL | Shared Ball resolver and online/paper candidate handling exist; full eligibility and package evidence parity need Golden coverage. |
| Referral deep link / LINE preservation | PARTIAL | Candidate is non-binding and survives current LINE path. QR UI and redirect E2E remain open. |
| Payment → placement pending | COMPLETE | Fresh isolated PostgreSQL Paper full-chain evidence covers Paper Application → Package Order → Receipt → Payment → `PLACEMENT_PENDING` → public placement reference → authorized placement → Ball allocation → `EFFECTIVE`. |
| Sponsor pending-placement workbench | COMPLETE | Member-safe queue and placement workbench now use public Ball numbers only. Sponsor authorization, slot/cycle/first-third-left validation and idempotency remain server-authoritative; Admin retains its separately RBAC-protected UUID command surface. |
| Placement → activation | COMPLETE | Paper full-chain isolated PostgreSQL E2E proves no pre-placement Ball, member-safe reference, server-authorized placement, exactly-one allocation and final `EFFECTIVE` Qualification. |
| Paper application / duplicate Person | PARTIAL | New Person intake now uses approved document-country/type policy, deterministic HMAC-SHA-256 fingerprint matching, unique fingerprint concurrency protection, safe audit events and a duplicate-review queue. Unconfigured document types fail closed. Review resolution and jurisdiction policy provisioning remain operational follow-up work. |
| Paper order | PARTIAL | `adminCreatePaperQualificationOrder` binds one OPEN paper application to one Qualification package order and reuses PackageConfig, SponsorResolver, Payment and Placement core. Paper retail, Admin wizard/read model and end-to-end payment/activation evidence remain open. |
| Paper receipt / payment confirmation | COMPLETE | Receipt evidence identity is immutable and retry-safe; conflicting evidence fails closed, dual control is enforced, and pre-placement reversal is covered. |
| Company Sponsor Alias v1 | COMPLETE | Effective-dated, audited Company Alias resolution is available for qualifying acquisition and paper intake; member views expose only governed display information. |
| Existing Member LINE link | COMPLETE | Fresh isolated PostgreSQL Paper→LINE evidence proves authoritative Person/memberNo reuse, self-approval rejection, approved one-time completion, single binding and replay rejection without new Person creation. |
| Retail attribution | COMPLETE | `retail-attribution-concurrency-db.e2e-spec.ts` runs two independently valid SponsorResolver candidates concurrently against one real PostgreSQL retail order. One authoritative temporal attribution/event persists; GiST/unique constraints reject the rival and a retry returns the survivor. |
| Retail checkout UX | PARTIAL | Candidate edit/clear/validation before first lock and locked display exist. Member retail order history is privacy-safe; the complete paid-order/fulfilment E2E remains open. |
| SKU retail referral parameters | COMPLETE | `retail-referral-db.integration.e2e-spec.ts` changes the current SKU rate after an immutable order-line snapshot, then recognizes exactly the original historical rate and Award. |
| Retail Active eligibility | COMPLETE | The real DB Golden preserves the recognition-time Active decision; later activation/replay cannot alter the original inactive zero-payable Award. |
| RETAIL_REFERRAL award | COMPLETE | Real DB recognition verifies immutable theory/payable amounts and no PV/Binary effects. Member and Admin Explain read stored evidence only; `retail-settlement-db.e2e-spec.ts` proves exactly-once UnifiedPayable materialization and zero-payable exclusion. |
| Retail return / recovery | COMPLETE | Real DB Golden verifies partial, full, repeated and paid-award return paths. Original Award rows remain immutable; recovery/clawback evidence is append-only and idempotent. |
| Operations explain / notifications | COMPLETE (Retail) | `adminExplainRetailReferralAward` exposes only stored attribution, SKU/rate, recognition-time Active, Award, payable/payout and recovery evidence under Admin RBAC; it does not expose consumer PII or recalculate historical economics. Paper and notification work is tracked in its respective rows. |
| P0 privacy / identifiers | COMPLETE | Member projection hides bootstrap Company Balls and Reservoir data, prevents non-direct holder PII disclosure, and uses business identifiers in normal flows. Pending placement is additionally covered by Ball-number-only regression. |
| OpenAPI / contracts | COMPLETE | `backend/openapi.generated.json` is regenerated for the current API and OpenAPI preflight passes. Existing operations remain governed by the generated artifact. |

## Preserved Retail Referral invariants

- Inactive referrer recognition preserves theory, records `payableAmount = 0`, and creates no PV, Binary or organization effect.
- Partial return preserves the original Award and appends one idempotent recovery effect.
- Retail attribution is independent of Sponsor and Binary relationships.
- Retail referral does not itself create GPV, PV, RPV, EPV, Binary, Sponsor or organization effects.

## Implementation sequence

1. Add approved duplicate-identity fields/review before enabling new-Person paper intake; retain existing-Person flow fail-closed until then.
2. Add Paper retail, wizard/operations read models and complete Payment → Placement → Activation and Paper → LINE E2E evidence.
3. Finish Retail Referral Golden coverage: effective SKU history, active history, full/multiple/paid return, settlement/payout, replay and explain.
4. Regenerate OpenAPI, execute full gates and complete closure reports.

## Explicit constraints

- No historical migration is edited; schema work is forward-only.
- Semantic DB, Analytics, LLM/RAG/Vector DB and deployment are outside this closure.
- Google Drive is not modified without explicitly authorized Drive tooling; any final closure must remain `CODE_CLOSED_DRIVE_SYNC_PENDING` until synchronized.




## Retail Referral closure

RETAIL_REFERRAL_CLOSURE = PASS as of 2f7680 plus the focused commits that follow. The replay Golden reads immutable order-line and Award evidence: later SKU/rate and Active changes cannot rewrite the original Award; return/recovery remains forward-only. Retail is feature-frozen pending final regression.

