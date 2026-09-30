# Member Growth evidence — 2026-10-01

Status: IN_PROGRESS. This records verified scope, not whole-batch or Stage approval.

## Server authority and privacy

`GET /member/my-growth` reads the authenticated Person in one Repeatable Read transaction. A Person without a Qualification can use this route; unknown query properties are rejected. The real HTTP test first reproduced the old Qualification-required failure, then verified 200 for the owner, 401 anonymously and 400 for a forged Person query.

The projection returns only currently held qualifications, historical achieved ranks, currently effective Active intervals, a distinct count of current sponsored qualification relationships, and the latest active/pending repurchase subscription. Active uses half-open recorded intervals rather than the mutable qualification flag. Month display follows Taipei time. Child identities and names are not returned. Subscription status is explicitly separate from recognition evidence.

Learning and event counters count all of the Person's records, independently of the 100-item preview. CHECKED_IN is separate from ATTENDED. Upcoming events require REGISTERED status, a published event and a future start. The 20 most recent saved learning/event milestones link to public course/event codes; no browser economic calculation is introduced.

The next-rank projection remains explicitly unavailable. No invented threshold, inferred current achievement or unapproved progress percentage is shown. Required next-rank acceptance remains open.

## Verified evidence

- Focused real PostgreSQL/HTTP: 4 suites / 5 tests PASS; fresh 124 migrations, 162 baseline assertions and disposable-database cleanup PASS (`cr-batch-growth-verified-final-db.log`). Includes 101 completed courses and 101 attended events with only 100 preview rows; check-in, archived upcoming event and another Person remain correctly separated.
- Member: 34 files / 181 tests and production build PASS (`cr-batch-growth-member-final-tests.log`, `cr-batch-growth-member-final-build.log`). API build, generated OpenAPI and preflight passed in the corresponding Growth logs.
- Real Edge local browser: Admin creates/publishes a course; a real synthetic LINE session with no Qualification enrolls, completes its lesson and course; Growth shows the persisted completion on desktop and 390px mobile. Production-mode Member build uses the existing explicitly enabled UAT bootstrap in a disposable directory. The test uses actual Nest HTTP routes, guards, PostgreSQL and production frontend assets; it does not simulate API responses. No horizontal overflow or browser page error was observed. Logs: `cr-batch-member-engagement-browser-final.log`; screenshots under `C:/UCell/logs/member-engagement-browser/`.
- Expanded real Edge run (`cr-batch-member-engagement-browser-final-acceptance.log`) also passes Admin event creation/publication, Member registration, opaque credential rotation and cancellation, personal notification read/archive, persisted read/archive counts and zero LINE delivery. Admin LIGHT/DARK/SYSTEM and Member system-dark behavior pass. An injected transport abort shows an error and a successful retry uses the real Growth API. Scratch build, browser, servers and database cleanup pass. This is bounded journey coverage, not all §34/§35 UX certification.
- Visual inspection found cramped mobile notification filters and raw role codes in the Admin shell. The filters now use full-width labeled controls; the shell displays Chinese role names, and the Learning required checkbox retains its natural width. Post-fix Admin 56 files / 188 tests and Member 34 files / 181 tests, plus both production builds, pass. Final post-fix browser rerun and cleanup PASS (`cr-batch-member-engagement-browser-ui-final.log`); updated screenshots were visually inspected.

## Full regression isolation finding

The first full API run reported 10 failed suites / 30 tests, with 171 suites / 1,287 tests passing. One Growth fixture still used an invalid plan code and is corrected. Other failures included committed fixtures from previous suites making the effective rule registry ambiguous or adding unrelated historical eligibility records. The three affected period/retail suites pass independently (17 tests) without changing production logic or weakening assertions.

The isolated runner now clones its migrated baseline into a separate disposable database for every Jest suite. An initial clone naming mismatch triggered existing protective test checks; the runner must retain the approved `ucell_jest_<32 hex>` naming convention. The corrected full rerun passes **181 suites / 1,317 tests**, fresh **0→124 migrations**, **162 baseline assertions**, per-suite database teardown and outer template cleanup (`cr-batch-growth-full-api-verified.log`). Existing protective name checks remain unchanged. No failed run is counted as certification.

## Remaining scope

Next-rank approved progress, full requirement-by-requirement matrix, additional empty/error/theme/accessibility journeys and whole-batch recertification remain open. No Stage/Production deployment was performed.
