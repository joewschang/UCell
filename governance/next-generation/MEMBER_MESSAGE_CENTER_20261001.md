# Member message lifecycle evidence — 2026-10-01

Bounded foundation implemented; overall Message Center remains IN_PROGRESS.

## Behavior and boundaries

Migration 122 preserves legacy content and first-read receipts, backfills publication from creation time, and adds publication/expiry/retirement metadata and recipient-bound archives. Read/archive evidence rejects update/delete. Archiving does not mark a message read.

Authenticated `/member/messages` uses the session person and optional currently held qualification. Personal messages work without a qualification. Publication and expiry determine current/history views; bounded keyset paging has a fixed creation horizon. Commands require idempotency keys, recheck access before replay, and retain the first recorded timestamp under concurrent requests. Audit failure rolls back the command.

Public responses use hashed MESSAGE references and qualification numbers. Legacy UUID text and labeled bank-account text are redacted; this is pattern-based protection, not a guarantee for arbitrary free text. New shared producers reject these patterns and restrict links to approved same-origin routes. Actual order delivery now uses the business order number. No LINE broadcast or financial writes are introduced.

Member UI supports personal/current-qualification messages, category/history filters, read/archive commands, paging and safe links. Demo behavior remains available. Learning/Event and remaining domain producers, full routing acceptance and actual-browser journeys remain open.

## Verification

- Five service DB cases passed against fresh 0→122 migrations, including BOLA, concurrent commands, rollback, expiry/retirement, safe output, pagination, delivery deduplication and actual order consumer behavior.
- Final authenticated HTTP DB case passed separately against fresh 0→122: anonymous/forged identity rejection, personal messages without qualifications, foreign-message denial, required keys, read replay and archive visibility. Each isolated runner passed 162 baseline assertions and cleanup.
- Historical 121→122 upgrade golden passed: original notice/read/order data preserved; immutable receipts and expiry constraint verified.
- Full DB Golden passed at migration 122, including existing member identity and economic regression checks; disposable database cleanup passed.
- Member 31 files / 175 tests and production build passed. Backend builds and schema/migration/security/OpenAPI preflights passed. POST documentation records the actual HTTP 201 response.

Logs are under `C:\UCell\logs\cr-batch-member-messages-*`. This is not latest full API isolated recertification or Stage approval.

## Learning/Event producer integration

Course enrollment/completion and event registration/cancellation/check-in now append personal messages in the same transaction as the authoritative action. Natural replay does not generate a second notice; renewed event registrations use a distinct credential cycle. Public bodies contain course/event business codes, never the check-in credential or private row identities. Message-write failure rolls back registration, audit and idempotency together. No historical backfill or scheduled reminders are inferred.

Members without a qualification can reach Learning and Events as well as their personal inbox. Destination APIs continue to enforce membership eligibility. The current list pages still need the full detail/progress/check-in journeys tracked under Learning/Event scope.

Three focused DB suites / eight tests passed on fresh 0→122 with 162 baseline assertions and cleanup. This includes actual producer replay, cancelled/re-registered event token isolation, private-person inbox isolation, unchanged LINE delivery count, and a real database failure injection proving transactional rollback. API build, Member 175 tests and build passed. Logs: `cr-batch-learning-event-messages-*`.
