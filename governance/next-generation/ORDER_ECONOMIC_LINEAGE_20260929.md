# Order economic evidence checkpoint — 2026-09-29

The privileged order-number read now adds `economicEvidence` without changing the existing fulfillment/payment/return fields. All facts are read in one Repeatable Read transaction. This is a read projection, with no new financial writes or migration.

Attribution follows explicit edges: ORDER PV events → BonusAward.sourceEventId → derived BonusAward.sourceAwardId → BONUS_AWARD PayableEntry. Payables include payout batch status and period, without attributing the entire batch total to the order. Recovery evidence is selected through either a linked award or an order ReturnCase; a recovery matching both edges appears once. A return-linked period award is not pulled into the order's award total: `awardIncluded: false` makes that boundary explicit.

Projection references are deterministic SHA-256 references scoped by record kind. Financial records use a field whitelist; raw UUIDs, recipient identity, calculation JSON, bank references, and payout details are not returned. New collections have deterministic ordering. Source-award traversal has a visited set to avoid repeated records/cycles; the database transaction timeout applies to the full read.

## Validation

- API build PASS.
- Full isolated API regression: 135 suites / 924 tests PASS; 162 baseline assertions, fresh 0→102 migrations and disposable database cleanup PASS.
- Focused isolated PostgreSQL regression: 3 tests PASS, fresh 0→102 migrations, 162 baseline assertions, disposable database cleanup PASS.
- Tests cover direct/derived award joins, exact payable attribution, unrelated same-recipient award exclusion, repeat-read determinism, identity/UUID exclusion, unchanged payable state, return-only recovery evidence, and duplicate-edge recovery elimination.

## Remaining scope

This checkpoint is explicitly `ORDER_PV_BONUS_AWARD_AND_RETURN_RECOVERY`, not complete economic lineage. Subscription recognition/RPV awards, historical replay postings without a sourceAward edge, Company/Reservoir B movements, and period settlement contribution evidence still need separate explicit joins. Global or binary period awards must not be attributed wholesale to one order. The existing Operations invariant expansion remains separate work. No deployment or external integration is performed.
