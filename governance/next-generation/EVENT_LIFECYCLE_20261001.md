# Event participation lifecycle — 2026-10-01

This increment implements bounded Admin and Member event journeys. Event acceptance remains IN_PROGRESS for reminders, remaining integration mapping and actual-browser acceptance.

## Authority and behavior

Migration 124 gives each registration cycle a private identity and captures registered/cancelled/checked-in/attended timestamps in append-only participation evidence. Renewed registration preserves the earlier cycle. Existing timestamps are backfilled with `LEGACY_SNAPSHOT` provenance; previously overwritten cycles are not reconstructed. Published versions, completed attendance, source identity and participation timestamps are protected by database guards. New evidence must match its registration source.

Event commands serialize on the event/registration rows and retry bounded serialization/unique conflicts. Capacity remains enforced by the source registration count. Concurrent cancellation, check-in and attendance have one effective result. Attendance requires a checked-in registration; checking in remains distinct from confirming attendance. No economic writes or LINE delivery are introduced.

Authenticated members can read upcoming, ongoing and their historical events. Their registration pins the version. Online joining information is limited to registered participants while the event is open. The Member page shows a safe personal credential in memory and provides an authenticated reissue action; reissue invalidates the previous credential. Replayed stale reissue requests cannot return an effective credential. Credentials are excluded from lists, messages, roster/history and ordinary detail responses. Personal notices link directly to the event business code.

Admin Super Admin, Membership Operations and Order Operations can create, publish with approval evidence, archive with a reason, read the roster, check in a presented credential and confirm attendance. DTO validation rejects forged extra input and invalid capacity/credential formats. The Admin page has stable retry keys, a private credential input that clears after success, and role-aware navigation. Archiving stops new participation commands and retains historical evidence.

Member360 includes preserved cycle history. Activity Timeline reads participation evidence instead of only the latest mutable registration state. Lists remain bounded to 100 events and 500 roster rows; UI labels state these bounds. No automatic reminder timing, waitlist or broadcast policy is inferred.

## Verification

- **5 isolated DB/HTTP suites / 10 tests PASS**, fresh **0→124**, 162 baseline assertions and cleanup. Actual session/role tests cover authenticated owner-only credentials, rejected roles, input validation, check-in, attendance and archive history. Service cases cover concurrent effects, two preserved registration cycles, stale credential rejection, immutable versions/evidence and safe joining-information access. Timeline regression passes.
- **123→124 preservation PASS**: exact old registration columns, version, event and unrelated order are retained; only extant timestamps become legacy evidence. Immutable guards and scratch cleanup pass.
- Full DB Golden at 124 PASS, including 356 Member identity and 59 Member/Admin real HTTP/DB assertions; cleanup PASS.
- Backend builds, Admin/Member builds and OpenAPI/security/schema/migration preflights PASS. Admin **56 files / 188 tests**, Member **33 files / 180 tests PASS**, including credential display/cancellation/retry and Admin roster/attendance controls.

Logs: `C:\UCell\logs\cr-batch-event-lifecycle-*`. This is not full isolated batch recertification or browser/Stage approval. Growth attendance counting is audited separately; previously conflated check-in/attendance totals are not covered by this increment.

Follow-up: real Edge Admin create/publish and Member registration/credential rotation/cancellation plus personal message read/archive now pass. Growth separates CHECKED_IN from ATTENDED and counts all records beyond the preview limit. See MEMBER_GROWTH_ACCEPTANCE_20261001.md; attendance-window browser flow and remaining full-scope acceptance are still open.
