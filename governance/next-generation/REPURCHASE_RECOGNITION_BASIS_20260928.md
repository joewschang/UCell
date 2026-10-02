# Repurchase recognition and partial-return basis

Continues local checkpoint `e7d9f1b`; this is implementation evidence, not a full CR batch or deployment approval.

## Behavior

If a 20% refund reduces a future recognition to 80%, and a further 30% refund arrives after recognition, the new recovery removes 30% of the original entitlement. It no longer removes 50% of the already reduced recognition. Both API and background Worker scale original upline awards to the retained entitlement and seal the prepaid amount and retained ratio in the immutable recognition snapshot.

Migration `20260928204000_recognition_refund_basis` adds the per-schedule retained ratio with a 0–1 constraint. New schedules default to one. Existing rows remain null, rather than receiving an invented historical ratio. Legacy rows with prior partial returns stop with a missing-basis error and require explicit reconciliation; existing records without partial-return history retain compatibility.

Subscription locking coordinates recognition and cancellation. Recognition locking serializes recovery consumers before their idempotency and cumulative reversal reads. Full cancellation is evaluated from all posted cancellation facts, so an older partial-return delivery cannot restore entitlement or duplicate recovery after a full reversal. Serializable transaction conflicts remain retryable through external redelivery; the DB Golden now also recognizes the observed raw-query PostgreSQL `40001` conflict carried by Prisma `P2010`.

Unrecognized `DUE` schedules receive the same refund adjustments as `SCHEDULED` schedules. Fully depleted future installments are cancelled. Existing recognition snapshots, original PV events, awards, and ReturnCases are preserved.

## Verification

Real PostgreSQL scenarios cover recognition between partial returns through API and Worker, replay against a later changed plan price using the sealed basis, concurrent distinct recovery commands and duplicate retries, delayed partial delivery after full recovery, and refusal to infer missing legacy refund history.

The isolated DB Golden passed, including 20 RPV concurrency assertions, Serializable conflicts and external redelivery, unchanged original recipients/snapshots, return outbox, membership, checkout, identity and replay-pool regression. Migration and Prisma relation preflights passed. Final API regression counts are recorded in the batch progress report.

## Remaining scope

Commercial Offering promotional composition, Operations invariant families, ERP transport/reconciliation and governed bank-format decisions remain tracked in the CR batch progress report. Existing production data has not been migrated or reconciled. No Stage/Production deployment is part of this checkpoint.
