# Learning lifecycle and member journey — 2026-10-01

This increment implements bounded course management and preserves enrollment authority. Overall Learning acceptance remains IN_PROGRESS pending assignment/reminder decisions, remaining applicable content/assessment acceptance and actual-browser journeys.

## Implemented behavior

- Admin Membership Operations/Super Admin can create a course with ordered lessons, publish with approval evidence, read safe business-code projections and archive with an audited reason. Nested HTTP DTOs reject unknown fields and malformed inputs. The Admin page provides these actions with persistent retry keys, validation and permission-aware navigation.
- Eligible members can browse, open a course, enroll, read approved article or HTTPS media/document/PDF references, record individual lesson progress and complete after all required lessons. The server supplies completion eligibility and counts. Article text is rendered as text; script/insecure/credential-bearing media links are not opened.
- Enrollment pins the original version. Publishing a newer version changes the view for new members, while existing enrollees retain their original content and progress. Archived courses remain readable to their enrollees, but no longer accept progress or publication. Course/actor/private enrollment identifiers are omitted from ordinary Admin and Member outputs.
- Course row locks and bounded serialization/uniqueness retries prevent duplicate enrollment, start, lesson and completion effects. First progress records COURSE_STARTED. Cancelled enrollment cannot progress. Completion remains independent of economic facts.
- Migration 123 prevents mutations to published versions/lessons, enrollment identity and completed evidence; progress is append-only with single effective course milestones/lesson completions and same-version lesson checks. It does not synthesize missing historical milestones.
- Learning notices now link directly to `/learning?course=<business-code>`. Current list readers are explicitly bounded to 100 courses. No video hosting or rich HTML execution is introduced.

## Verification

- Final frozen-code isolated DB run: **4 suites / 11 tests PASS**, fresh **0→123**, 162 baseline assertions and disposable database cleanup. Includes actual authenticated HTTP roles/validation, lifecycle, pinned versions, archive privacy, concurrent commands, immutable evidence and transactional Learning/Event messages.
- **122→123 preservation PASS**: existing course/version/lesson/enrollment/progress and unrelated order remain byte-for-byte equivalent at the ORM projection; new immutable guards reject mutation. Scratch database cleanup PASS.
- Full DB Golden at migration 123 PASS, including 356 Member identity HTTP/DB assertions and 59 Member/Admin HTTP/DB integration assertions; cleanup PASS.
- Backend builds and final API build PASS. Admin **55 files / 187 tests**, Member **32 files / 178 tests**, both production builds PASS. OpenAPI generation/preflight, security, migration and schema preflights PASS.

Logs: `C:\UCell\logs\cr-batch-learning-lifecycle-*`. An intermediate run overlapped the deep-link change and failed the old link expectation; the final frozen-code 11-test run supersedes it. The Admin navigation expectation was updated to include the newly authorized Learning entry, followed by the full 187-test pass.

This does not certify all §34 Learning/Event integration, all rich-content/optional-assessment or assignment/reminder cases, actual-browser accessibility/themes/mobile, full-batch isolated recertification, or Stage readiness. No Stage/Production deployment was performed.

Follow-up: the real Edge Admin publish → no-qualification Member enrollment/lesson/completion → Growth journey now passes, including production assets and disposable PostgreSQL cleanup. See MEMBER_GROWTH_ACCEPTANCE_20261001.md for bounded browser evidence and remaining scope.
