# Engagement outreach browser acceptance — 2026-10-01

Verified against base 017d991 with the current local UI fixes. The checked-in member-engagement-browser.mjs uses a fresh localhost-only PostgreSQL database, actual Nest application, production frontend builds and real headless Microsoft Edge. It preserves all earlier publish/learning/event/message/Growth/Global journeys and adds actual Admin outreach commands through the page controls.

Covered new journey:
- Admin creates/publishes a second course, assigns it to the public member number, loses the response after the server commits, and retries with the exact original key. One enrollment/assignment message remains. A later new-key assignment explicitly reports already enrolled and preserves learning history.
- Admin sends and repeats a learning reminder; UI distinguishes created from already notified. The owner sees both messages and follows the safe course link, completes the pinned first version, and sees exact Growth totals and a localized assignment milestone.
- Course completion retires the reminder; the active view excludes it, the historical view preserves it and has no actionable link.
- Member re-registers the event, Admin creates/repeats the individual reminder, Member follows the source link and cancels. The retired reminder remains in historical messages without a link; one reminder per actual cycle is retained. No LINE delivery row is produced.
- An unrelated authenticated member receives no messages from this journey. No private identifier is rendered by the preserved rank/privacy assertions.
- Admin mobile dark view has no horizontal overflow. Member visible buttons and nav-link text in the tested message views meet computed >=4.5:1 contrast in dark/light modes. Screenshot inspection caught light backgrounds persisting beneath dark-mode text; member controls/nav now use the active surface token, with disabled and selected-tab theme handling. This is bounded control-text acceptance, not a claim of complete WCAG or whole-site contrast certification.

UI defects repaired: event REMINDER_CREATED/ALREADY_NOTIFIED previously used the unknown-status fallback; course assignment/reminder results previously shared a generic save notice. Explicit Traditional Chinese outcome labels now match the authoritative response, including no-effect outcomes. Member control/nav theme backgrounds now match their text.

Final actual-browser PASS plus fresh-database cleanup PASS; zero page errors. Member full suite/build, focused Admin tests/typecheck/build pass. Logs, source/build and screenshot hashes are stored in evidence/engagement-outreach-browser-20261001.json. Backend implementation/migration and OpenAPI artifacts were verified byte-identical to the preceding 185-suite / 1,333-test gate source; no new full API gate is claimed for UI-only work.

This covers the implemented individual assignment/reminder flow; broader source routing, remaining personalized producers, full Learning/Event/Growth matrices and entire §34/§35/§36 UX are still open. Overall implementation and recertification IN_PROGRESS; Stage RC NOT_READY. No Stage/Production deployment.
