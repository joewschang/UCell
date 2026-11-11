# Daily member greeting posters

Issue: https://github.com/joewschang/UCell/issues/53

Latest expanded publishing requirements and next implementation: [publishing handoff](DAILY-GREETINGS-PUBLISHING-HANDOFF.md). The admin upload/publish and external cloud scheduler are not part of this phase.

## Scope and status

This change adds a public daily-poster API and the greeting card at the top of the member Explore page. It has not been deployed to production. A successful source build is not evidence that Azure is serving it or that the daily schedule is active there.

The first version is deterministic template generation, not a generative-AI service: one original sun/hills/leaves illustration, four colour palettes, twelve reviewed ordinary greetings, and date-specific festival copy. The user-supplied official gold UCell logo is embedded unmodified with its 16:9 aspect ratio, including its original white background and company name. It renders a fresh dated 1080 × 1080 PNG with Traditional Chinese text and UCell 宇生國際 branding. It uses no member information, external image API, new paid service or database migration. Text and template variation repeat; add reviewed copy/artwork through a normal release to broaden the collection.

## Schedule and resilience

- Time zone: Asia/Taipei; release boundary: 07:00 every day.
- At startup, the API immediately prepares the currently released date. Before 07:00, this is the previous day's image; afterward it is today's.
- An in-process timer pre-renders each next date at 07:00. Every request independently calculates the correct released date, so restarts or missed timers cannot strand yesterday's content. A request crossing the boundary rechecks its date after rendering.
- There is no external scheduler or persisted publication record. Ensure at least one API replica remains running if generation must occur exactly at 07:00 rather than on the first later request. Do not infer that this setting is already configured.
- Native rasterization runs in a dedicated worker thread, separate from the payment/settlement Worker and the API event loop. One conversion runs at a time, at most four distinct dates can queue, identical requests share one job, each conversion times out after 10 seconds, and a 32-image cache bounds memory. Saturation returns 503 instead of creating unbounded work. Normal API ingress rate limiting remains applicable.
- The image URL is tied to its date. Date inputs are validated; unpublished future dates and dates before 2026 are rejected. Renderer/font updates can change historical bytes; this is not an immutable asset archive. Preserve old published PNGs in object storage before promising permanent historical artwork.

## API and member experience

All endpoints are public and contain no member identifiers or referral attribution:

- `GET /api/v1/public/daily-greetings/current`: normal JSON envelope, no-store, date/copy/image/share URL and release/refresh times.
- `GET /api/v1/public/daily-greetings/YYYY-MM-DD/image.png`: raw PNG, image/png, public cache, CORP cross-origin.
- `GET /api/v1/public/daily-greetings/YYYY-MM-DD/share`: no-script HTML with absolute Open Graph image metadata.

Explore fetches without member credentials. The card independently handles loading/retry, image failure, stale windows, date rollover, visibility resume and interrupted/repeated actions. A response that expires in transit is retried once. No greeting failure blocks the existing Explore links.

When LIFF's shareTargetPicker is available, the member deliberately opens the picker to choose recipients and send an image. Otherwise the button explicitly says `LINE 連結分享` and shares the public greeting-page URL. Closing the picker is not reported as a successful send. Saving uses PNG download; iOS or LINE webviews may require the explicit open-original/long-press fallback. No automated messages are sent to members or third parties.

## Runtime requirements

- `DAILY_GREETING_PUBLIC_API_BASE_URL`: public HTTPS API base. Default is the existing production `https://api.ucell.life/api/v1`; set the correct stage origin for stage deployments. Do not use a member-site URL unless it actually proxies those API routes.
- Noto Sans CJK font: `deployment/Dockerfile.backend` installs `font-noto-cjk`. `DAILY_GREETING_FONT_PATH` can name an installed `NotoSansCJK-Regular.ttc` or compatible file. Missing CJK fonts fail closed rather than publishing unreadable posters.
- Member CSP must allow the configured API origin for images; this change uses the existing `__API_ORIGIN__` build substitution. Keep API CORS permitting the member origin so browser blob download works.
- Existing LIFF capability/configuration is required for direct image sharing. Verify the deployed LIFF SDK independently; this change does not upgrade the existing locked SDK version.

## Festival verification

The 2026–2027 lunar festivals use an explicit reviewed date table. Do not replace it with Node/ICU Chinese-calendar inference: the current Node 24 runtime gives a one-day error for Lunar New Year 2027.

Sources:
- https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2026.pdf
- https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2027.pdf
- https://data.weather.gov.hk/weatherAPI/hko_data/calendar/nongli_calendar_2027.csv

2027 dates: New Year February 6, Lantern Festival February 20, Dragon Boat June 9, Mid-Autumn September 15. Fixed-date greetings include New Year, Taiwan Father's Day, Teachers' Day, Double Tenth and Christmas; Mother's Day uses the second Sunday of May. These are greeting themes, not claims about statutory days off. Extend the reviewed lunar table before 2028; unreviewed years use ordinary and fixed-date greetings rather than guessed lunar dates.

## Verification and remaining release gates

Passed locally on 2026-11-11:
- Frozen member/backend dependency installation with pnpm 12.4.1; Prisma client generation.
- Full backend workspace build; API build after final concurrency/lifecycle fixes.
- 11 greeting unit and isolated Nest/Fastify HTTP tests: boundary, invalid/future dates, lunar dates, PNG dimensions/signature, queue bound and singleflight, event-loop responsiveness, boundary during render, shutdown during warmup, font failure, CORS/CORP, envelope and raw OG/PNG responses.
- All 61 member test files / 332 tests, including 16 greeting tests; TypeScript and Vite production build.
- OpenAPI export and preflight. The full regenerated artifact contains unrelated existing source drift, so it is not included in this feature commit; CI must regenerate and bind its own artifact.
- Visual inspection of the 1080px 2026-11-11 PNG, including the official logo, Chinese glyphs and illustration. The PNG is included as an isolated browser-test fixture.

Not completed locally:
- Chromium browser QA: host fails `socket() Operation not permitted`, including after the permitted escalation retry. The new isolated `member/tests/daily-greeting-smoke.cjs` covers widths 320/390/768/1280, PNG download, LINE-link activation, failures/retry and visibility resume; CI is configured to run it. All external requests are mocked or blocked.
- Real LINE picker, iOS Photos/Files and Android download verification.
- Full isolated PostgreSQL suite, OpenAPI governance with pinned oasdiff, security/UAT/backup/restore/release evidence, Docker image/font smoke and Azure revision tests. A standalone whole-API `tsc --noEmit` exhausted the 2 GB heap; the supported `nest build` passed instead.
- Azure deployment identity is not available in this execution environment. No merge, image push, production revision change or production schedule activation has been performed.

After required CI/review/release gates, follow `deployment/PRODUCTION.md`: build the changed API and member components, record image digests/current revisions and rollback digests, deploy sequentially, verify today's API image and Explore card, test real-device sharing/saving, and verify the next Taipei 07:00 update. Do not use live tests to send member notifications.
