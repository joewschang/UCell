# ERP bridge read integrity

Bounded §35 read-model repair; four-stream implementation and whole-batch certification remain IN_PROGRESS.

Two regression failures were reproduced before fixing the reader: raw Worker error text was exposed as an ERP reason, and post-fetch status filtering could return the lookahead row before advancing the cursor past that row, causing repetition on the next page.

The reader now exposes only known ERP reason/exception codes, with a fixed safe fallback. It filters only the scanned page; the lookahead establishes whether another page exists. Empty filtered pages preserve the continuation token, and the Admin page explicitly offers the next page. Actual PostgreSQL coverage verifies the empty-page → matching-next-page boundary and safe failure text.

Handoff and exception reads share a RepeatableRead transaction. `asOf` is explicitly the fixed handoff-creation horizon across pages. Mutable order, fulfillment, outbox and exception statuses are current reads, not reconstructed historical states; `dataThrough` now reports the current read time separately. OpenAPI and UI describe that distinction.

Verification: initial 2 failures / 4 passes; final isolated 2 suites / 8 tests PASS, migrations 0→117, 162 baseline assertions and cleanup PASS. API build, regenerated OpenAPI/preflight, Admin focused test/typecheck/build PASS. Logs: `C:/UCell/logs/cr-batch-erp-bridge-*20260930.log`.

No source facts, transport, credentials or deployment were changed. Sales, Return, Compensation projection and four-stream acceptance remain required.
