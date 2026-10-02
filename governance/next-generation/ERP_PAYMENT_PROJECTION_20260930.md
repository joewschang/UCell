# Whole-batch ERP payment review projection — 2026-09-30

Authority: §35 FER-6/8/9. Payment and compensation-period aggregation remain separate scopes. No journal, bank transfer, live ERP acceptance or accounting mapping is invented.

## Implemented

- Finance previews a whole payout batch using a hashed business reference and exact payout period. Batch discovery uses keyset pagination over the same canonical business hash; no payout/recipient UUID is returned.
- Preview requires independent Finance/Compliance approvals, an immutable verified export, exact export/batch/line totals, typed original Bonus/RPV/Global Payable source ownership/amount/rule/category, source maturity, recorded recovery applications and consistent bank results. Unresolved HIGH/CRITICAL payout exceptions block preview.
- Gross is optionally grouped by economic category. Recovery offset, payout net and bank paid remain whole-batch measures. They are not attributed to individual award categories or compensation periods. Separate measurement rows are not a journal total.
- Confirmed paid amount uses maximum cumulative PAID evidence per line. Historical 40→130 confirmations contribute 130, not 170. Explicit confirmed/pending line counts distinguish missing bank response from confirmation of a zero-net transfer.
- Canonical review hash binds explicit accounting-date/denomination configuration, dual approvals, immutable export hash, exact Payables, applications and bank evidence. Finance approves that reviewed hash with a business approval reference. Source changes invalidate preview. Concurrent approval is single-effect; audit failure rolls back projection and Outbox. Identical requests replay immutable evidence; conflicting same-batch approval fails.
- Admin provides batch discovery, preview, approval and full-line source drillback. API role rules match Compensation: Finance approves, Finance/Compliance/Super Admin read, Order Operations cannot access financial data. Existing missing-mapping guards keep transport blocked.

## Evidence

- Disposable PostgreSQL fresh **0→119**, **162 baseline assertions**, affected financial/HTTP **2 suites / 22 tests PASS**, cleanup PASS. Added actual governed cross-period payout with recovery, cumulative bank results, concurrent approval, stale preview, audit rollback, zero-net confirmation, blocking exception, source/batch pagination and HTTP role tests.
- Admin **5 files / 11 tests PASS**, covering payout business selection, reviewed-hash approval and preview invalidation; Admin production build PASS.
- API production build, generated OpenAPI, OpenAPI preflight and security policy preflight PASS. No schema migration.
- Logs: `C:\UCell\logs\cr-batch-erp-payment-final-tests-20260930.log`, `cr-batch-erp-payment-admin-test.log`, `cr-batch-erp-payment-api-build.log`, `cr-batch-erp-payment-admin-build.log`, `cr-batch-erp-payment-openapi-preflight.log`, `cr-batch-erp-payment-security.log`.

Mapping attachment/versioning and explicit supplemental snapshots after further bank/return changes remain internal work. Exact ERP account mapping and live transport remain external dependencies. Full four-stream/browser and whole-batch recertification are pending; no Stage/Production deployment or Stage-ready claim.
