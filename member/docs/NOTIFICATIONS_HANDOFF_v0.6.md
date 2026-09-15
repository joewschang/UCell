# Notification center v0.6 — demo UI and integration handoff

Implemented: persistent header entry, current-scope unread count, category and unread
filters, expandable details, explicit mark-one/mark-current-scope-read, empty state,
and pending real-service state. No new packages. Data and read state are in memory.

Demo scope is explicit: Person-wide announcements have null qualificationId and are
visible in both demo qualifications; private notices belong to q1 or q2. Reading a
shared announcement updates its badge in both contexts; private read state does
not change another qualification. Changing qualification remounts filters/details.
Refreshing or session-expiry unmount resets demo reads. Bulk reads affect the whole
current scope, not just a category filter; button wording states this scope.

## Backend decisions/integration required

- Existing baseline proposed GET /api/v1/member/notifications, but Person and
  qualification audience semantics, pagination/cursor and unread response contract
  are not approved. Real mode intentionally makes no request to that endpoint.
- Server must resolve recipients from authenticated Person/owned qualifications.
  Browser filtering and mock guards do not establish authorization or BOLA safety.
- Choose whether unread count applies to the Person inbox, active qualification,
  or both. Include explicit scope and version/asOf in the eventual response.
- Agree read-ack endpoint, idempotency, concurrency semantics, notification expiry,
  retention and read persistence. Ack failures must not be displayed as committed
  reads; stale replies after context changes/session expiry must be discarded.
- Restrict notification navigation targets to approved internal routes. Render text
  safely; do not render arbitrary HTML or execute action URLs from message payloads.
- LINE push delivery/consent, retry, delivery receipts and user preference management
  are separate from the in-app read state. No LINE setting or push action exists here.
- Final names, content, dates and regulatory statements require authorized sources;
  current messages are explicitly fictitious and contain no real account identifiers.

Required integration cases: two Persons, cross-qualification denial, shared versus
private scope, duplicate and failed ack, concurrent devices, deleted/expired notice,
pagination/count consistency, revoked session and approved deep-link validation.

Local tests cover isolation, shared read state, atomic foreign-ID rejection,
duplicate read, empty/filter state, detail expansion, refresh reset, zero network
or storage writes and real-mode fail-closed behavior. Browser cases are in the
Member CI smoke script; CI evidence is retained seven days. Real LINE UAT remains
pending. Backend, business rules, main and production are unchanged.
