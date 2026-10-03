# Personal Learning/Event assignment and reminders — local closure increment

Authority: §34 EXP-4 / EXP-6 requires course assignment/reminder and personalized event reminder through the UCell Member Message Center under §33. These commands do not create LINE work or broad broadcasts.

Implemented:
- Membership Ops/Super Admin can assign an open published course to a public member number, or remind an eligible member's incomplete pinned enrollment. Assignment creates one enrollment, immutable COURSE_ENROLLED/COURSE_ASSIGNED evidence and personal message atomically with an audit record. Existing enrollments are preserved, not re-pinned or restarted.
- Membership Ops/Super Admin can remind a registered member of a future published event. The reminder uses the existing registration's pinned version and cycle; it discloses no joining URL, QR credential or private ID in the message. It expires at that version's start time. ORDER_OPS retains ordinary event management but cannot create these personalized reminders; the UI hides that control.
- Reminders are deduplicated per Taipei calendar day and enrollment/registration cycle across keys and operators. Cancellation/re-registration has a new cycle and may receive a new reminder. Cancellation, course completion and archive retire applicable pending reminders in the same transaction, preserving historical messages.
- Serializable idempotent commands, source/recipient locks and existing immutable message guards prevent duplicate effective actions; fixed personal templates and safe source links do not accept user-supplied message destinations/content.
- Admin published-course/event cards contain labeled member-number/action/reason forms with in-flight/retry handling from their existing command handlers. Member access remains the existing person-scoped message center and source APIs. Growth now includes the assignment milestone with a Traditional Chinese label; Member360 and Timeline read existing enrollment/progress evidence.

Migration 126 adds COURSE_ASSIGNED to the existing exact type whitelist, one assignment per enrollment and no lesson identity for an assignment. Prior event types and immutable-evidence guards are retained. 125→126 preservation checks retain exact Person, version, enrollment and old progress rows; new assignment is accepted, duplicate/unknown event types and old-event mutation are rejected. This migration is local only.

Focused proof: 12 isolated API suites / 28 tests, fresh 0→126, 162 baseline assertions and cleanup PASS; upgrade preservation/cleanup PASS. Actual HTTP tests verify anonymous/wrong-role denial, ORDER_OPS reminder denial, forged Person/link rejection and authorized personal commands. DB cases verify concurrent assignment, cross-operator daily reminder deduplication, pinned enrollment, own/foreign message reads, completed/ineligible/archived rejection, atomic audit-failure rollback, event expiry, cancellation and new-cycle reminder. Admin 3 files / 3 tests and Member Growth test/build pass; API/Admin/Member production builds and schema/migration/relation/enum/security preflights pass. Full governance results are recorded separately after its active runner completes.

The first attempts exposed a malformed local controller edit (repaired before testing), fixture type/mocked-time issues and the missing DB whitelist admission. Failed attempt logs are preserved; only terminal verified results count. Full actual-browser reminder/assignment journeys, full source routing/remaining domain producers, applicable content/assessment mapping and overall batch UX remain open. No claim of whole-batch closure or Stage readiness.

LOCAL_IMPLEMENTATION = IN_PROGRESS
FULL_ISOLATED_RECERTIFICATION = IN_PROGRESS
STAGE_RC = NOT_READY

Final full OpenAPI governance gate PASS: fixed oasdiff 1.32.1, unchanged approved baseline, zero strict WARN breaking findings, 25 publisher/governance tests, full isolated **185 suites / 1,333 tests**, 126 migrations, 162 baseline assertions and cleanup PASS. Admin full **57 files / 191 tests**, typecheck and build PASS; five Growth/timing artifact tests PASS. Evidence captures the pre-commit working-tree source hashes and terminal gate report; its reported commit is the base, not a claim of testing an absent future commit. No publication or deployment. Whole-batch recertification still IN_PROGRESS.
