# Member API timeout

Member API requests have a 15-second client deadline, covering fetch and JSON
body consumption. Timeout aborts the request and displays a retryable message
through the existing resource error state. Timers and caller abort listeners are
removed when the request finishes. Timeout does not expire the session.

Caller cancellation (route/qualification change) and session expiry retain their
existing semantics. No automatic retry is introduced, especially for writes:
an aborted request is not proof that the server did not process it. Any future
order mutation still requires approved server idempotency and reconciliation.

Validation: 72 tests PASS (67 retained, 5 new), TypeScript and Vite build PASS.
New tests cover stalled headers, stalled response body, explicit retry, caller
cancellation, session expiry and timer cleanup after an HTTP error. CI results
are recorded in the shared development baseline against the published commit.

The current rc1-recovered tree was checked for Member/LIFF auth implementations;
no Member session exchange implementation was found. Real LIFF bootstrap remains
fail-closed. No new endpoint, backend policy, or business rule is assumed.
