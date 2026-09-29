# Operations Company / Reservoir B integrity — 2026-09-29

Continues `809ae3d`. The Operations invariant endpoint now includes a bounded Company / Reservoir B reconciliation read in a Repeatable Read transaction.

## Candidates

- `COMPANY_AWARD_DESTINATION_MISSING`: a BonusAward, RPV upline award or Global award belongs to Company at its original economic timestamp but has no destination sidecar. Company bootstrap identities follow the existing Core rule; ordinary qualifications use the historical owner interval, including its exclusive end boundary.
- `RESERVOIR_B_ENTITLEMENT_MISMATCH`: a selected destination lacks exactly one original ENTITLEMENT effect or its original amount differs from the sealed final award. A zero-valued award still requires original evidence.
- `RESERVOIR_B_REPLAY_MISMATCH`: original-source replay postings lack their exact linked signed Reservoir B effects, use an inconsistent recipient/member recovery path, or effects reference unexpected postings. Legitimate negative adjustments are not compared with the original amount as if they were missing original credits.
- `RESERVOIR_B_MEMBER_PAYABLE_CONFLICT`: a member payable references an award already routed to Reservoir B.

References use the qualification business number, award type and economic timestamp/period. Internal IDs participate only in the evidence hash and are not exposed in candidate details. No source ledger, destination, effect, payable, exception or task is changed by this query.

## Verification scope

The seven focused tests use disposable PostgreSQL. Missing-destination and interrupted-writer fixtures are observed within a transaction and explicitly rolled back before deferred economic guards run; no trigger is disabled. Valid original and signed replay effects are inserted through the existing database constraints, then checked for unchanged original evidence. The member-payable conflict is tested with injected legacy read evidence because current database guards correctly prohibit that write; it is not claimed as a successful conflicting database insert.

The test suite covers all three award source kinds, exact historical ownership/end-boundary behavior, zero-amount originals, missing and valid signed replay effects, deterministic results and internal-ID exclusion. API build and focused **7 tests / 162 real-DB baseline assertions / 102 fresh migrations** passed. Full API results are recorded in the batch progress report.

Final full isolated API regression: **134 suites / 921 tests PASS**, **162 real-DB baseline assertions**, **102 fresh migrations**, and cleanup PASS. Log: `C:/UCell/logs/company-reservoir-full-api-20260929.log`.

## Limits and remaining work

The endpoint samples up to `take` recent rows per source family and destination family (maximum 200); it is not an exhaustive historical audit. Current database guards remain the write authority. Additional economic-lineage timeline expansion, other broken-lineage checks, external ERP reconciliation and bank-format decisions remain tracked in the CR batch. No new migration or Stage/Production deployment is included.
