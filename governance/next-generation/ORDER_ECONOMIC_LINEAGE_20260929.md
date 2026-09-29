# Order economic evidence checkpoint — 2026-09-29

The privileged order-number read now adds `economicEvidence` without changing the existing fulfillment/payment/return fields. All facts are read in one Repeatable Read transaction. This is a read projection, with no new financial writes or migration.

Attribution follows explicit edges: ORDER PV events → BonusAward.sourceEventId → derived BonusAward.sourceAwardId → BONUS_AWARD PayableEntry. Payables include payout batch status and period, without attributing the entire batch total to the order. Recovery evidence is selected through either a linked award or an order ReturnCase; a recovery matching both edges appears once. A return-linked period award is not pulled into the order's award total: `awardIncluded: false` makes that boundary explicit.

An order-linked Subscription is now followed through its authoritative MonthlyRecognitionSchedule. Each recognition joins only its exact `SUBSCRIPTION` RPV ledger event, RPV generation awards, and the immutable RPV HistoricalReplaySnapshot plus append-only replay postings. The projection reports recognition-time Active eligibility, theory/payable amounts, rule/snapshot identity and replay deltas from stored evidence; it does not recompute history from current state.

Projection references are deterministic SHA-256 references scoped by record kind. Financial records use a field whitelist; raw UUIDs, recipient identity, calculation JSON, bank references, and payout details are not returned. New collections have deterministic ordering. Source-award traversal has a visited set to avoid repeated records/cycles; the database transaction timeout applies to the full read.

Company destinations are selected only through the BonusAward and RPV award IDs already attributed to the order. `reservoirBDestinations` joins their immutable destination and ordered effects, preserving the original final amount and signed replay adjustments separately. Source references join the existing award references; tree, owner, qualification, destination and effect UUIDs and raw parameter snapshots are excluded. Other orders sharing the same Company recipient are excluded.

## Validation

- API build PASS.
- Company / Reservoir B full isolated API regression: 141 suites / 973 tests PASS, fresh 0→106 migrations, 162 baseline assertions and cleanup PASS. Log: `C:/UCell/logs/reservoir-lineage-full-api-20260929.log`.
- Company / Reservoir B focused isolated PostgreSQL regression: 2 suites / 13 tests PASS, fresh 0→106 migrations, 162 baseline assertions and cleanup PASS. Covers explicit Bonus/RPV source references, unrelated same-recipient order exclusion, signed replay effects, deterministic reads, internal-ID exclusion and unchanged destination/effect records. Fixtures use real guarded database writes inside rollback transactions; no constraint is disabled.
- Subscription RPV/replay focused isolated PostgreSQL regression: 4 tests PASS, fresh 0→106 migrations, 162 baseline assertions, disposable database cleanup PASS.
- Full isolated API regression: 135 suites / 924 tests PASS; 162 baseline assertions, fresh 0→102 migrations and disposable database cleanup PASS.
- Focused isolated PostgreSQL regression: 3 tests PASS, fresh 0→102 migrations, 162 baseline assertions, disposable database cleanup PASS.
- Tests cover direct/derived award joins, exact payable attribution, unrelated same-recipient award exclusion, repeat-read determinism, identity/UUID exclusion, unchanged payable state, return-only recovery evidence, duplicate-edge recovery elimination, exact order→Subscription→recognition RPV attribution, and immutable replay delta presentation without internal identifiers.

## Remaining scope

This checkpoint is `ORDER_PV_AWARD_RETURN_SUBSCRIPTION_RPV_REPLAY_AND_RESERVOIR_B`, not complete economic lineage. Period settlement contribution evidence still needs separate explicit joins. Global or binary period awards must not be attributed wholesale to one order. Reservoir B effects are included only for already attributable Bonus/RPV sources, not whole-period balances. The existing Operations invariant expansion remains separate work. No deployment or external integration is performed.
