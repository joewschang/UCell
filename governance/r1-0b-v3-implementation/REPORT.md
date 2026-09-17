# R1.0B Decision Register v3 implementation report

## Stable closure checkpoint — 2026-09-17

- Decision Register v3 is implemented against `recordVersion=3`; `pendingDecisions=[]` remains authoritative.
- Migration 41 adds immutable ConsumptionRecognition, concrete GPV/RPV/EPV classification evidence, Qualification-month Active evidence, immediate theory/Binary ledger evidence, Business Calendar/payout anchors and Reservoir A.
- Migration 42 adds signed append-only Reservoir A/Welfare replay deltas with replay-action uniqueness. Original pool, award, ledger and PAID records remain immutable.
- GPV recognition performs historical Sponsor Referral/Matching theory and Qualification-scoped Binary ancestor propagation in one Serializable transaction. Theory does not create premature final K0 or PAID entitlement.
- Fixed-generation Matching preserves historical generations; ineligible intermediate generations append zero evidence and traversal continues without compression, substitution, redistribution or backfill.
- POSTED returns recompute the historical Qualification month, Active interval, EPV and downstream evidence. Missing historical evidence fails closed; PAID reductions append Recovery/CLAWBACK.
- Business dates use Asia/Taipei, Sunday 00:00 half-open weekly boundaries, 10/25 settlement batches and fixed nominal payout mapping with versioned business-day adjustment.
- Global undistributed amount is transferred to Reservoir A exactly once. Replay appends signed deltas; Welfare remains accrual-only.
- Member/Admin read projections expose Active interval/month, theory/final/payable separation, settlement/calendar evidence and Reservoir A. Unfinalized monetary results are returned as `PENDING` with `amount=null`.
- Mandatory v3 Golden cases: 17/17 PASS.
- Official isolated API suite: 38 suites / 343 tests PASS.
- Member: build PASS; 136/136 tests PASS. Admin: build PASS; 31/31 tests PASS.
- Fresh isolated DB Golden: 42 migrations PASS; all deterministic DB suites PASS, including 356 Member identity assertions and 8 replay-pool-delta assertions.
- Offline/dependency preflight, Prisma validate/generate/migrate, Backend/API/Worker build, OpenAPI preflight, Security policy preflight and RC gate PASS.
- Legacy Test Drift corrected in the DB Golden fixture: unfinalized Member bonus readback now expects `PENDING`/`null`; underlying append-only ledger facts remain asserted separately.

## Stage/UAT disposition

- Code and automated Connected DEV evidence are ready for a Stage image/deployment checkpoint. Stage preflight: 19/19 assertions PASS; upgrade/Golden harness: 7/7 tests PASS; UAT seed safety test PASS.
- Formal Stage redeployment and Connected Golden Journey remain operationally blocked: Azure Security Defaults requires a fresh interactive CLI login, and Stage PostgreSQL plus LINE/LIFF and Entra/RBAC credentials are not available to this deployment session.
- Synthetic credentials must not be used as formal provider evidence.
- Production Promotion remains BLOCKED; no Production resource or promotion is authorized.
## Incremental Boundary Closure checkpoint — 2026-09-17

### IMPLEMENTED

- Added deterministic Asia/Taipei settlement windows at the 10th/25th 00:00 boundaries using `[previous_cutoff,current_cutoff)`.
- Binary weeks remain atomic and map by canonical Sunday close to the next applicable 10th/25th batch.
- K0 numerator and Referral/Referral Matching denominator now share one immutable window evidence object and hash.
- Return POSTED replay appends a superseding inactive interval when historical consumption removes Active; original Active/Award/Ledger/PAID evidence remains unchanged.
- Global recipient amounts round down deterministically at persisted precision; every residue remains undistributed and enters Reservoir A. No Reservoir outflow was added.

### EXECUTABLE_EVIDENCE

- Boundary B01-B20: PASS.
- Shared calendar: 19/19 PASS; focused API boundary/regression: 52/52 PASS.
- Full isolated API: 39 suites / 354 tests PASS.
- Decision v3 Mandatory Golden: 17/17 PASS on a fresh 0→42 test database.
- Member build + 136/136 tests PASS; Admin build + 31/31 tests PASS.
- Fresh isolated DB Golden, replay/return/recovery, K0/K1/K2/carry regressions, OpenAPI, Security preflight and RC gate PASS.
- No migration added; existing 42 migrations deploy cleanly from zero.

### STAGE_READY

- Stage preflight 19/19, upgrade/Golden harness 7/7 and UAT seed guard PASS.
- Latest Boundary Closure HEAD must be deployed; Stage has not yet been changed by this checkpoint.

### EXTERNAL_CREDENTIAL_BLOCKED

- Azure interactive login must be completed before resource inspection/deployment.
- Stage PostgreSQL deployment secret and formal LINE/LIFF/Entra credentials are unavailable to this session.
- `ADMIN_AUTH_BYPASS=false` remains enforced. Manual Admin UAT requires the approved Stage Entra test user; no bypass was introduced.

### DEFERRED_BY_PRODUCT_OWNER

- Inventory PICK/SHIP accounting timing. Existing Payment PAID → inventory reserve behavior remains unchanged and this deferral does not block functional Stage UAT.

Production Promotion remains BLOCKED.
