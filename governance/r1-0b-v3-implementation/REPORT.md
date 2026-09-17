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