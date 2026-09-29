# Economic lineage coverage audit and Admin read view — 2026-09-29

Authority: DC-12 in `UCELL_PHASE_1_RELIABLE_MVP_SCOPE_DECISION.md`. This is a source-edge audit and first structured Admin view, not full business certification of all eight award engines.

| Award family | Stored attribution used by the order read | Coverage boundary |
| --- | --- | --- |
| REFERRAL | ORDER GPV → BonusAward.sourceEventId | Direct awards, descendants, payable and recovery evidence; original snapshot fields only |
| RETAIL_REFERRAL | Order → OrderLine → BonusAward.sourceEventId, constrained to RETAIL_REFERRAL | Fixed in this slice: Worker uses the order-line ID, not a PV ID; zero payable/inactive evidence retained |
| EQUALIZATION | ORDER GPV → BonusAward.sourceEventId | Confirmed against referral-bonus writer; direct source mapping, not recipient coincidence |
| BINARY | Sealed BINARY_K1 source cohort → period context; return run checkpoints → exact action postings | Whole-period award context only; no full award allocation to one order |
| MATCHING | BonusAward.sourceAwardId descendants and sealed MATCHING_K2 period context | Binary-derived linkage or whole-period context; no unrelated recipient join |
| RPV | Order → Subscription → recognition → RPV award/snapshot/postings | Recorded PV/entitlement balance and cancellation/schedule facts remain distinct |
| EPV | Order → original EPV → awards/snapshot/postings and exact PV adjustments | Recorded balances; does not rerun monthly eligibility or certify pending replay completion |
| GLOBAL | Sealed GLOBAL source cohort → historical recipients/corrections | Whole-period context only; no per-order allocation of Global awards |

The retail gap was found by comparing the read with `backend/apps/worker/src/main.ts` and the existing RetailReferralExplainService. The new query only adds RETAIL_REFERRAL awards whose sourceEventId is an exact OrderLine of the selected order. Other award kinds cannot enter through an order-line UUID. Awards now expose safe source-line references, original Active evidence and K. Two real PostgreSQL cases verify payable 0/10, same-recipient other-order exclusion, wrong-kind source exclusion and UUID/detail exclusion. These tests validate the reader against the stored writer contract, not a new Worker run.

## Admin view

`/economic-lineage` is available under the bonus navigation group to SUPER_ADMIN, ORDER_OPS, FINANCE and COMPLIANCE_AUDIT, matching the existing server endpoint. It performs GET only, accepts a decimal business order number, supports same-order refresh and abortable requests, and hides cached financial results during refresh or after errors. Invalid input and unauthorized roles do not query.

The page presents dated events chronologically, with current/undated state separately labeled at the end. Expandable, whitelisted fields cover PV, awards, subscription recognition, retained balances, period context, recovery applications, replay checkpoints/effects, Reservoir B and payout reports. Safe human source labels connect direct/derived award evidence; raw JSON and reference hashes are not dumped into the UI. Zero values and unavailable values remain distinct. Explicit labels preserve whole-period and whole-payout-line context, non-additive payment reports, and the difference between calculation checkpoints, offsets and cash payment. CSS supports narrow layouts and reuses current design tokens.

## Validation and limitations

- API build PASS; focused isolated PostgreSQL **2 suites / 41 tests PASS**, fresh **0→106 migrations**, **162 baseline assertions**, cleanup PASS. Log: `C:/UCell/logs/retail-lineage-focused-20260929.log`.
- Admin typecheck/build PASS; full Admin tests **36 files / 134 tests PASS**. New UI tests cover ordered rendering, zero entitlement, context labels, hidden internal/private fields, stale-result suppression after refresh error, retry/empty state, validation and role denial. Navigation membership tests also pass.
- Actual browser visual inspection could not run: both the in-app browser automation and Node computer-use kernel returned `failed to write kernel assets: 系統找不到指定的路徑。 (os error 3)` before browser creation. The temporary synthetic-data preview files and dedicated Vite process were removed. Desktop/mobile visual acceptance remains unverified; this is not authenticated browser UAT.
- No migration, financial writer, deployment, Stage/Production action or external integration is included. The prior 999-test API full regression predates the retail reader change; this slice ran the focused API suites.
- Remaining closure work includes zero-eligibility calculation evidence that produced no Award row, dedicated all-family lineage Goldens, deeper retail attribution/rate explanations, full common Explain fields, exhaustive UI/visual/accessibility acceptance and full-batch recertification. The eight families have identified source paths; this does not mark economic lineage or Stage RC complete.
