# R1.0B Onboarding and Retail Referral Gap Audit

Status date: 2026-09-25. Scope is the R1.0B onboarding and retail referral closure request. A status is COMPLETE only where API, domain, database, UI, security, and tests form a usable vertical slice.

| Area | Status | Evidence and remaining gap |
|---|---|---|
| A. WEB_MEMBER | PARTIAL | Zero-Ball WEB_MEMBER retail orders now reuse `commerce.order` with `purchaserPersonId`, and the Member shop supports their checkout. Account/order history read-model completion and end-to-end DB evidence remain required. |
| B. Qualification Package Catalog | PARTIAL | Backend versioned package catalog and Member package shop exist; catalog seed/three current R1.0B package verification remains required. |
| C. Pricing Context | PARTIAL | WEB_MEMBER orders use server-side list price and zero GPV/PV snapshots; qualified retail remains Qualification-scoped. Boundary regression evidence remains required. |
| D. SponsorResolver | PARTIAL | Ball-number resolver, public minimal candidate read, invalid/UUID rejection and bootstrap fail-closed tests exist. Governed Company alias and full R1.0B sponsor eligibility policy are DECISION_REQUIRED. |
| E. Referral deep link | PARTIAL | `?ref=` candidate survives LINE login and is not directly bound. QR is an equivalent URL form, but no generated QR UI test exists. |
| F. Qualification Acquisition | PARTIAL | Qualification package checkout revalidates candidate and writes selection evidence. Full acquisition read model remains missing. |
| G. Payment to Placement Pending | PARTIAL | Paid sponsored package creates Sponsor relationship and `PLACEMENT_PENDING`; unsponsored legacy path remains `BALL_SETUP_PENDING`. |
| H. Sponsor Pending Placement | PARTIAL | Member and admin placement APIs exist; Member UX workbench with minimal identity/package/wait time is incomplete. |
| I. Placement to Activation | PARTIAL | Existing placement service activates Qualification. End-to-end onboarding activation regression is missing. |
| J. Paper Application | PARTIAL | Admin application accepts `sponsorCode` via the shared resolver. Wizard and duplicate prevention workflow are incomplete. |
| K. Paper Order | MISSING | No authoritative `ADMIN_PAPER_ORDER` acquisition slice identified. |
| L. Paper Payment Evidence | MISSING | Existing generic payment confirmation does not provide paper receipt evidence and dedicated authorization workflow. |
| M. Existing Paper Member LINE Link | PARTIAL | LINE security/rebind foundation exists; the verified existing-member link request workflow and invariant golden are incomplete. |
| N. Retail Referrer Attribution | PARTIAL | Separate temporal attribution, first-attributed-order lock, candidate revalidation, admin forward correction, immutable events and line snapshots exist. DB concurrency and correction integration tests remain required. |
| O. Retail Referral Checkout UX | PARTIAL | Zero-Ball Member shop supports add/edit/clear/validate before the first attributed order and displays a locked referrer thereafter. Delivery/profile and order-history integration remain incomplete. |
| P. SKU Retail Referral Parameters | PARTIAL | Effective-dated enabled/calculation/rate/base fields, DB constraints and Product Admin scheduling UI exist. Product rule approval workflow and DB history tests remain required. |
| Q. Retail Referrer Active Eligibility | PARTIAL | Worker calls the existing Active/Company-always-active authority at payment recognition and records the result in Award detail. Historical Active evidence/replay tests remain required. |
| R. RETAIL_REFERRAL Award | PARTIAL | `RETAIL_REFERRAL` uses existing BonusAward lifecycle from immutable line snapshots and isolated payment outbox handling. Award persistence/settlement/payout integration tests remain required. |
| S. Retail Return / Recovery | PARTIAL | Worker adds append-only offset, reversal or recovery effects by paid-state and return amount. Multi-return and payout/recovery integration tests remain required. |
| T. Admin/Member UX | PARTIAL | Member retail checkout and Product Admin SKU rule UI exist; Paper wizard, attribution correction UI and retail explain remain incomplete. |
| U. Audit / Notification | PARTIAL | Retail attribution writes Audit/outbox; payment and return events are isolated. Operator notification and explain read models remain incomplete. |
| V. OpenAPI | PARTIAL | Generated artifact includes Member retail candidate/read, admin correction and SKU profile APIs. Contract tests and final structural diff remain required. |

## Constraints and decisions

- Reuse Person, Qualification, Order, Payment, Sponsor, Placement, Active, Award, Return, Replay, Recovery, Audit, and Notification infrastructure.
- Retail Referrer Attribution is distinct from SponsorRelationship. Retail implementation must not create Sponsor/Binary edges or PV effects.
- Company sponsor aliases are not implemented because no governed alias policy is present. Status: `DECISION_REQUIRED`.
- Local PostgreSQL is available. The Phase 2 isolated DB regression is self-contained and passes after the fixture repair.

## Implementation order

1. Add forward-only Retail Referrer Attribution, effective correction, and immutable order-line snapshot foundation.
2. Add effective-dated SKU retail referral parameters and contracts.
3. Add WEB_MEMBER retail checkout boundary and attribution lock/verification UX.
4. Add recognition-time Active adapter and `RETAIL_REFERRAL` award through existing award/replay/recovery infrastructure.
5. Complete paper intake/order/payment/link workflows and end-to-end regressions.

## 2026-09-25 closure update

- Existing-member LINE link now has verified-subject request, approved one-time completion token, binding/session completion, and focused fail-closed tests for bound subjects and token replay.
- Admin can read the authorized link queue and Retail Referrer attribution history; Person 360 supports forward-only correction.
- Retail focused regression: worker dispatch, attribution lock/candidate, zero-Ball delivery boundary and LINE-link boundary tests pass.
- Remaining `DECISION_REQUIRED`: ADMIN_PAPER_ORDER/payment receipt authority and Company Sponsor alias policy. No implementation is inferred from these absent rules.
