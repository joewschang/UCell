# Generic governed Payout core acceptance

This status covers the controlled Finance review export and manually recorded external result. It does not claim a bank-import layout or execute a transfer. Bank-specific format remains BLOCKED_EXTERNAL_BANK_FORMAT.

| Required invariant | Status | Evidence |
| --- | --- | --- |
| EXPORT_DOES_NOT_MARK_PAID | PASS | payout-export-artifact-db: EXPORTED with paidAt null |
| EXPORT_IDEMPOTENT | PASS | one revision-one artifact; concurrent exact retries after FAILED/PARTIALLY_PAID/PAID preserve hash and state |
| LOCKED_SNAPSHOT | PASS | database approved-line/total guards; immutable stored artifact survives changed current holder; revision-scoped verified downloads |
| BANK_DATA_MASKING | PASS | generic review contains no bank/account fields; HTTP Finance restriction and no bank details in lineage; actual bank formatter separately blocked |
| PARTIAL_TO_PAID | PASS | append-only cumulative per-line results, monotonic maxima and actual paid lifecycle |
| FAILED_RETRY | PASS | failed transfer followed by success without new Payable |
| NO_DUPLICATE_AWARD | PASS | result replay does not recalculate awards; materialization unique source and concurrent result tests |
| POST_PAYMENT_RECOVERY | PASS | 162-assertion real DB baseline: original PAID preserved, exact clawback, nonnegative partial offsets and retry |
| PAYOUT_LINEAGE | PASS | real Retail Worker → maturity → Payable → reviewed/approved/exported/paid batch → order reader; replay correction payout tests |

Governed generic exports preserve revision, SHA-256, amount/recipient business references and period in immutable source bytes. Finance and Compliance approvals are independent, downloads audited, and changed export intent cannot overwrite a prior artifact. An approved corrected bank-payment layout remains outside the available generic review format; no bank destination is guessed.

Fresh verification: payout focused **4 suites / 21 tests PASS**; materialization boundary **5 suites / 28 tests PASS**; lineage **8 suites / 121 tests PASS**, each with 113 migrations, 162 DB assertions and cleanup. API builds and security/OpenAPI preflights PASS. See PAYOUT_EXPORT_REPLAY_20260930.md, PAYABLE_BOUNDARY_20260930.md and ECONOMIC_LINEAGE_ACCEPTANCE_20260930.md.

PAYOUT_GENERIC_CORE = PASS. Full batch implementation/UX/recertification is a separate gate.
