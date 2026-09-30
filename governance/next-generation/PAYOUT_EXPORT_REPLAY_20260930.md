# Payout export replay after payment results

The same export reference previously failed after the batch advanced from EXPORTED to FAILED, PARTIALLY_PAID or PAID. Three new real-PostgreSQL cases reproduced the rejection before repair (payout-export-replay-before-20260930.log).

Export now resolves the immutable artifact under the existing batch lock before considering new-export state transitions. It verifies artifact scope/hash/content before replay, rejects a reference belonging to another batch, and returns the saved artifact without changing payment status, paid timestamps, lines, results, revision or export audit count. Finance RBAC remains enforced before lookup. A different reference still cannot create an unapproved replacement export.

Validation: **4 suites / 21 tests PASS**, fresh **0→113**, **162 baseline DB assertions**, cleanup PASS. The three regression cases issue concurrent retries and verify one artifact, one export audit, unchanged batch state and unchanged hash. Existing Finance HTTP authorization, immutable export, partial reconciliation, failed retry, snapshot guards, legacy result and CSV integrity tests also pass. API build, security preflight, OpenAPI preflight and diff check PASS.

Logs: C:/UCell/logs/payout-export-replay-after-20260930.log and payout-export-replay-build-20260930.log. No API shape, migration, bank transfer or Stage/Production deployment changed. This focused fix does not claim whole-batch closure or invent a bank-specific format.
