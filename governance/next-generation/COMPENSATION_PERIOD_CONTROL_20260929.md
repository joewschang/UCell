# Compensation Period Control — 2026-09-29

Authority: `UCELL_PHASE_1_RELIABLE_MVP_SCOPE_DECISION.md` §35 FER-11 through FER-18. This is local evidence only. It does not close an ERP accounting month and does not authorize Stage or Production deployment.

## Implemented control view

`GET /api/v1/admin/compensation-period-control` and the Admin page **獎金與會員經濟營運控制中心** provide a Repeatable Read view for one exact compensation period and Rule Version.

The view composes existing authoritative facts only:

- governed Referral K0, Binary K1, Matching K2 and Global period-close jobs, Outbox delivery and sealed receipts;
- finalized SettlementBatch facts and aggregate Theory/Award values;
- append-only Reservoir B and BonusRecovery evidence;
- Payable materialization;
- payout approval/export/payment-result facts;
- independent fulfillment ERP attention count.

The derived lifecycle can report `OPEN`, `PRECHECK`, `READY_TO_CLOSE`, `SETTLING`, `BLOCKED`, `AWARD_FINALIZED`, `MATURING`, `PAYABLE_READY`, `PAYMENT_REVIEW`, `BANK_RECONCILING` or `FINANCIALLY_RECONCILED`. It is explicitly a read/control state. No hard-close flag is persisted, and `FINANCIALLY_RECONCILED` does not claim an ERP or statutory accounting close.

Where the repository lacks one sealed cross-volume completeness receipt, the checkpoint returns `NOT_AVAILABLE`; it does not infer completeness from current records. ERP accounting projection remains `BLOCKED_EXTERNAL / ERP_ACCOUNT_MAPPING_REQUIRED` until accounting authority supplies the mapping.

## Privacy and authority

- RBAC: `SUPER_ADMIN`, `FINANCE`, `COMPLIANCE_AUDIT`.
- Internal PeriodCloseJob, snapshot, settlement, payout, Qualification and Person UUIDs are not returned.
- Job and payout references are deterministic non-reversible safe references.
- No actor identity, raw parameter snapshot, bank payload, provider credential, delivery PII or secret reference is returned.
- Amounts are read from UCell facts. ERP totals never feed UCell calculation.

## Crash/restart Golden

The real Worker process test force-kills a child process at two boundaries for all four supported job kinds:

- before the replay snapshot/receipt is sealed: the transaction rolls back, lease expiry permits one new claim, and retry completes once;
- after commit: receipt and Outbox acknowledgement remain committed, and redelivery returns the existing result.

Referral K0, Binary K1, Matching K2 and Global each pass both boundaries for empty and funded periods: **16/16 tests PASS**. Repeated delivery preserves the exact economic rows, Carry, Reservoir effect, snapshot, receipt and attempt count.

## Evidence

- `period-close-worker-crash-db.e2e-spec.ts`: 1 suite / 16 tests PASS against disposable PostgreSQL and real OS child processes.
- `compensation-period-control.e2e-spec.ts`: 1 suite / 5 tests PASS, including raw-error privacy regression.
- `compensation-period-control-db.e2e-spec.ts`: 1 suite / 1 real-DB test PASS after fresh 0→109; 162 baseline DB assertions and cleanup PASS.
- Admin focused navigation/RBAC/control UI: 3 files / 11 tests PASS; full Admin regression: 39 files / 148 tests PASS.
- API and Admin production builds PASS.
- Generated OpenAPI and preflight PASS (**217 paths / 235 operations / 123 schemas**).

## Remaining §35 work

- No write command for Soft Close or Hard economic close has been introduced. Persisted close authority and late-input disposition require a separate governed design; the read model does not fake it.
- A single sealed GPV/RPV/EPV input-completeness receipt is not present.
- ERP compensation/accounting projection and exact account mapping remain external.
- Sales and Return bridge streams beyond currently persisted UCell/fulfillment evidence remain open.
- Aging thresholds must come from operational configuration before a parameterized aging dashboard can be certified.

No Stage or Production resource was read or changed.
