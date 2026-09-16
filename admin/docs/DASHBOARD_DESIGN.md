# Operations dashboard — Midnight Current

Scoped redesign of the authenticated homepage: midnight blue, teal/violet/amber
accents, four count cards, an active-qualification ring, role-filtered work queues,
order counts and governance links. Other admin pages retain their existing theme.

All displayed metrics still come from `/admin/dashboard/summary`. The ring is
activeQualifications / qualifications, shown only for valid nonnegative integer
counts with a positive denominator and active <= total. This is a qualification
snapshot, not a Person active rate, revenue chart, growth trend or NASL funnel.
Today/month orders count creation timestamps under the backend's calendar logic.
Payables and recoveries display counts, not money. Missing values are dashes.

The screen shows backend generation time in the browser's timezone and flags
refresh errors while retaining the previous successful response. No static green
claim of backend readiness or production certification is displayed. Shortcut
visibility uses existing canOpen rules; server authorization is still required.

`member/tests/admin-dashboard-smoke.cjs` injects synthetic HTTP responses only in
Playwright, with all external requests and writes blocked. No mock backend or
new authentication bypass is added to the application. Preview screenshots are
marked as development previews. Checks cover four widths, valid/zero-denominator
ratios, stale-response warning and restricted-role shortcut visibility.

Admin dependencies were absent in this checkout and no admin lockfile existed.
The initial CI install generated a lockfile, now checked in; the workflow uses
frozen installation. As in Member, esbuild is the only permitted build script.
Production rollout, real Entra login and full backend/DB gates are outside this
visual change. No business rules, migrations or payment operations are modified.
