# Typed Recovery period acceptance — 2026-10-01

Actual RPV and Global workflows now verify period financial reconciliation across their typed Recovery anchors. No production economic calculation changed.

- RPV: API and Worker recognition retain original award 80 after the first refund, then actual cancellation Replay posts −30. The original award and sealed snapshot remain unchanged. Period evidence follows the posting to its typed Recovery, reports outstanding 30, then actual payout application reports applied 30 / outstanding 0 and net 50. Independent approvals, immutable export and bank confirmation 50 are required before financial readiness.
- Global: actual historical qualification/volume inputs settle the original Global award. A real Return produces one signed Replay recovery through the zero-value Global anchor. Replayed delivery remains single-effect. Period evidence finds the Recovery by original typed award linkage, follows actual offset application, and becomes ready only after governed export and bank payment.

Final isolated PostgreSQL: 2 suites / 11 tests PASS, fresh 0→121 migrations, 162 baseline assertions and disposable cleanup. Initial RPV test failures were fixture errors: overlapping due times and a payout cutoff preceding payable availability. Corrected fixtures use distinct recognition instants and a valid payout cutoff; production policy was not relaxed.

Command: `node scripts/api-jest-isolated.mjs --testRegex 'test/(member-global-economic.integration|test.repurchase-partial-return-db.e2e-spec)\.ts$'`.

Evidence: `C:\UCell\logs\cr-batch-typed-recovery-period-final-db.log`. This completes the typed Recovery linkage/offset/bank acceptance gap, not whole §35 or batch certification. Detailed source UI, stage timing, browser journeys and full recertification remain open.
