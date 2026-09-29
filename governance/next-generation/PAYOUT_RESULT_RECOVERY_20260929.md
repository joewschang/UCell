# Payout result recovery and snapshot guards

This implements part of the approved §31 payout closure. Full payout/batch closure and Stage RC readiness remain unproven.

## Reproduced failures and repair

The new isolated PostgreSQL regression reproduced five failures before repair: a fully failed batch rejected actual successful retry; a smaller cumulative paid report was accepted; a FAILED report could erase an earlier partial payment from the projected balance; concurrent identical reports raised a write conflict; and duplicate-line/overprecision input was accepted.

Reconciliation now locks the batch before reading, validates exact four-decimal input and one result per line, and matches immutable replay evidence. Identical reports have one result and one audit under concurrency. New confirmed amounts cannot decrease earlier confirmed payments. FAILED batches can accept later actual result evidence without creating another Award or Payable. Projection uses cumulative confirmed maxima instead of relying on timestamp ordering. Full line confirmation marks Payables and appends the corresponding BonusAward PAID lifecycle once.

Migration 110 preserves historical rows and adds append-only result/approval protection, result-to-batch/line and amount guards, plus immutable approved financial lines/totals. Approval and export serialize on the same batch lock as line changes and reconciliation. The upgrade Golden verifies historical batch, line, approval, artifact and result values remain unchanged, then exercises the new guards and a valid later payment.

## Admin flow

The existing payout page now offers independent approval at REVIEWED and export at APPROVED, exposes all lifecycle states, and lets Finance reconcile EXPORTED/PROCESSING/PARTIALLY_PAID/FAILED batches per line. The form requires explicit external evidence and cumulative amount, preserves input on failure, and sends zero paid amount with a documented failure. Approval remains independent on the server. The page displays a business qualification reference instead of the qualification UUID and disables preparation for read-only roles.

## Evidence

- Before-repair failure log: `C:/UCell/logs/payout-result-recovery-before.log`.
- Affected API/real-DB regression: 3 suites / 92 tests PASS; the subsequent lock-race suite has 7 tests PASS. Fresh 0→110 and 162 baseline assertions/cleanup PASS.
- Final 109→110 upgrade preservation and guards PASS; DB Golden PASS with cleanup.
- API build, migration/relation/enum/OpenAPI/security preflights PASS.
- Admin typecheck/build and 41 files / 153 tests PASS, including reviewed/approved action gates, failed-batch Finance scope, partial-result payload and retry retention.
- Full frozen-code API regression: 154 suites / 1,162 tests PASS, fresh 0→110, 162 baseline assertions and cleanup. The subsequent test-only strengthening explicitly observes PostgreSQL lock waiting before releasing concurrent approval; its 7-test isolated suite also PASS. Runtime/migration source is unchanged from the full run.

The legacy `mark-paid` compatibility route now locks the same batch and writes one immutable, cumulative PAID result for every payout line through the shared reconciliation writer. It requires a non-empty external reference and method, preserves an exact already-paid replay without inventing backfill evidence, rejects changed intent, and rolls all payment evidence back if its final audit cannot commit. It remains a record of an external result, never a bank-transfer command.

Actual bank-specific formats/transport are not supplied or enabled. Recipient/bank snapshot review, governed replacement revisions and broader actual-browser UX remain open; no automatic bank transfer or deployment is introduced.
