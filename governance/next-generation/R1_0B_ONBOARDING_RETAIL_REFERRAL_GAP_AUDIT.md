# R1.0B Onboarding and Retail Referral Gap Audit

Status date: 2026-09-25. Scope is the R1.0B onboarding and retail referral closure request. A status is COMPLETE only where API, domain, database, UI, security, and tests form a usable vertical slice.

| Area | Status | Evidence and remaining gap |
|---|---|---|
| A. WEB_MEMBER | PARTIAL | `Person.membershipState` and LINE network registration exist. Retail shopping remains Qualification-scoped, so a zero-Ball WEB_MEMBER retail checkout is missing. |
| B. Qualification Package Catalog | PARTIAL | Backend versioned package catalog and Member package shop exist; catalog seed/three current R1.0B package verification remains required. |
| C. Pricing Context | PARTIAL | Package checkout is server priced. Retail pricing still requires explicit WEB_MEMBER versus QUALIFIED_MEMBER boundary coverage. |
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
| N. Retail Referrer Attribution | MISSING | No distinct attribution model, lock, correction, or order snapshot exists. |
| O. Retail Referral Checkout UX | MISSING | Connected shop has checkout and delivery profile but no WEB_MEMBER retail referral input/verify/add-edit-clear flow. |
| P. SKU Retail Referral Parameters | MISSING | ProductRuleProfile is effective-dated, but has no retail referral enabled/calculation/rate/base fields. |
| Q. Retail Referrer Active Eligibility | MISSING | Existing Active evidence may be reused; no retail award adapter calls it at recognition as-of. |
| R. RETAIL_REFERRAL Award | MISSING | Existing BonusAward infrastructure exists; no award type/recognizer/evidence slice exists. |
| S. Retail Return / Recovery | MISSING | Existing return/replay/recovery infrastructure exists; no retail referral effect adapter exists. |
| T. Admin/Member UX | PARTIAL | Package, delivery and existing admin applications are present. Paper wizard, retail attribution/correction, SKU parameters and retail explain views are missing. |
| U. Audit / Notification | PARTIAL | Shared audit/outbox and notification delivery foundation exist. Onboarding and retail-specific event coverage is incomplete. |
| V. OpenAPI | PARTIAL | Generated artifact and preflight exist; new missing vertical slices naturally have no contracts yet. |

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