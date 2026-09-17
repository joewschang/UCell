# R1.0B Decision Register v3 — Code Gap Analysis

Date: 2026-09-17 (Asia/Taipei)  
Baseline: `4272bbe`  
Authority: `governance/sa-decisions/decisions.json` recordVersion 3

No pending product decisions remain in Decision Register v3. External credentials and operational data may still block Stage/UAT execution, but they do not reopen approved business semantics.

| Area | Status | Decision | Current behavior | Required implementation / evidence | Migration | Economic impact |
|---|---|---|---|---|---|---|
| PV/BV classification | CHANGE_REQUIRED, TEST_REQUIRED | SA-20260917-13 | `PvType` represents `PV` beside GPV/RPV/EPV; no abstract-class guard | Preserve historical concrete rows; add semantic guard; prove generic PV/BV cannot create Award/Ledger and no duplicate volume is migrated | Additive metadata only if needed | None |
| Recognition chain | CHANGE_REQUIRED, MIGRATION_REQUIRED | SA-20260916-05, SA-20260917-13/14 | Worker derives GPV directly from paid OrderLine; no ConsumptionRecognition entity | Persist versioned eligible ConsumptionRecognition, then immutable concrete VolumeRecognition; Payment remains evidence only | Yes | Prevents invalid recognition; formulas unchanged |
| GPV immediate effects | CHANGE_REQUIRED, MIGRATION_REQUIRED, TEST_REQUIRED | SA-20260917-14 | Referral/Matching theory and Binary aggregation occur during settlement | At GPV recognition append historical Referral theory, fixed-generation Matching theory/zero evidence and per-ancestor Binary side ledger; no final K0/Award before batch | Yes | Timing/evidence only |
| Active interval | CHANGE_REQUIRED, MIGRATION_REQUIRED, TEST_REQUIRED | SA-20260917-16/17 | Admin opens Active periods manually | Qualification-month accumulator; threshold crossing creates `[timestamp, month-end)` snapshot before same-event award eligibility; next month independent; return replays interval | Yes | Approved eligibility timing |
| EPV eligibility | CHANGE_REQUIRED, TEST_REQUIRED | SA-20260915-02, SA-20260916-05/17 | Monthly service scans paid repurchase order amount | Aggregate eligible ConsumptionRecognition per Qualification/month and recompute whole historical month after POSTED return | Recognition migration | Formula unchanged |
| Multiple Balls | TEST_REQUIRED | SA-20260917-17 | Qualification ownership boundaries exist | Prove Active, volume, direct count, Carry, Award and Global rights never cross Ball | No | None |
| Referral Matching generations | CHANGE_REQUIRED, TEST_REQUIRED, LEGACY_DRIFT | SA-20260917-19 | Ineligible rows are skipped without zero evidence; legacy Equalization unlock tests remain | Historical Sponsor fixed generations; failure writes zero evidence and traversal continues; no stop/compression/substitution/backfill | Evidence fields/table | Removes legacy redistribution |
| RPV | TEST_REQUIRED | SA-20260917-16/17/19 | Binary routing and 5/8/12 unlock exist | Bind to authoritative recognition and v3 Active snapshot; preserve zero-generation evidence | No/new evidence FK | Frozen amounts unchanged |
| Binary recognition ledger | CHANGE_REQUIRED, MIGRATION_REQUIRED, TEST_REQUIRED | SA-20260917-14/17 | Settlement scans historical tree/snapshots | Append immutable Qualification/ancestor/side ledger at recognition; settlement aggregates ledger | Yes | Same eligible GPV |
| Weekly Binary calendar/caps | CHANGE_REQUIRED, MIGRATION_REQUIRED, TEST_REQUIRED | SA-20260917-14 | Generic intervals and legacy weekday examples | Sunday 00:00 Asia/Taipei half-open week; enforce 450k/900k/1.5m; expose derived 1.8m/3.6m/6m reference | Yes/config seed | Formula unchanged |
| 10th/25th settlement | CHANGE_REQUIRED, MIGRATION_REQUIRED, TEST_REQUIRED | SA-20260917-14 | Arbitrary intervals; no canonical scheduler | Canonical settlement slot/date and idempotent worker catch-up; final K/pool/Award only in applicable batch | Yes | Timing only |
| Payout/Business Calendar | CHANGE_REQUIRED, MIGRATION_REQUIRED, TEST_REQUIRED | SA-20260917-15 | Literal `occurredAt + pendingDays*86400000` | Immutable BusinessCalendarVersion/date rows; persist settlement, nominal and adjusted dates; fixed 10→25 and 25→10 mapping; next business day | Yes | Timing only |
| Historical calendar replay | CHANGE_REQUIRED, TEST_REQUIRED | SA-20260917-15 | Generic snapshot keeps legacy pendingUntil | Seal calendar version/slot/dates; replay preserves authoritative anchor and appends deltas | Yes | No overwrite |
| Global / Reservoir A | CHANGE_REQUIRED, MIGRATION_REQUIRED, TEST_REQUIRED, LEGACY_DRIFT | SA-20260917-18 | Empty rank slices roll upward; no Reservoir A | Stop redistribution; append source-period-linked idempotent Reservoir A entries and replay deltas | Yes | Pool conserved under approved rights |
| Welfare | ALIGNED, TEST_REQUIRED | R1.0B | 2% accrual-only; update immutability evidence incomplete | Block UPDATE/DELETE; prove no Award/Payable/Ledger credit; append replay adjustments | Trigger hardening | None |
| Return/replay | CHANGE_REQUIRED, TEST_REQUIRED | SA-20260915-01, SA-20260916-12, v3 | K0/K1/K2/EPV/RPV replay exists; Active/Global/Reservoir/Welfare absent | POSTED recomputes Active, concrete volumes, theories, Binary ledger, Global/Reservoir/Welfare and downstream deltas; PAID uses recovery | Additive evidence | Delta only |
| Stage/UAT | BLOCKED_EXTERNAL | Release governance | Stage is older deployment; formal identity secrets absent | Deploy only after v3 gates pass, then guarded seed and formal credential Golden Journey | Stage migration | No Production resources |

## Mandatory executable evidence

The implementation gate must cover all 17 Product Owner cases: Active threshold timing/month reset; Ball isolation; exact Sunday boundary; immediate GPV effects without premature K0; weekly caps/month reference; both payout mappings and holiday shift; Reservoir A normal/retry/duplicate/replay/rollback; generic PV/BV prohibition; historical GPV no-duplicate classification; inactive Matching continuation; Active/EPV return replay; and PAID append-only recovery.

## Legacy drift disposition

- `CURRENT_SSOT_POINTERS.md` must point to Decision Register v3 and the volume clarification.
- PaymentConfirmed → GPV documentation/tests without ConsumptionRecognition are obsolete.
- Empty Global rank-slice roll-up tests are replaced by Reservoir A evidence.
- Literal 45×24-hour tests are replaced by fixed payout batches and BusinessCalendarVersion.
- `EQUALIZATION` may remain compatibility terminology only when runtime semantics match fixed historical Sponsor generations.
