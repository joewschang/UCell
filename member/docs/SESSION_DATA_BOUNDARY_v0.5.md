# Member v0.5 — browser session/data boundary

Baseline: 94611fdf6b058006e74a752887a5d581b8bab246. Frontend-only increment.

## Session lifecycle

`session.ts` owns a page-lifetime guard. A 401 makes it terminally expired for that
page, clears known local auth/qualification keys, aborts registered fetches and
notifies `SessionBoundary`. The boundary sits outside QualificationProvider, App
and CommerceProvider, so expiry unmounts all scoped views and in-memory demo state.
Late success and delayed body parsing are checked before data is returned.
Scoped 403 is a visible denied response without invalidating the entire session.
Invalid JSON produces a generic retryable error; raw response bodies are not shown.
Completed/aborted requests unregister their controllers and external abort listeners.

The reconnect button reloads the page through the existing LIFF bootstrap. There
is no client-side reset/unlock method. The current real bootstrap remains blocked
pending approved Member session exchange; this increment cannot authenticate a user.
Browser expiry is NOT token revocation, a backend logout API or a security proof.
When live auth is introduced, bind credentials to Person, authorize every request,
implement expiry/revocation/CSRF as appropriate to the selected session mechanism,
and test simultaneous requests against real server sessions and two Persons.

## Runtime response validation

`validation.ts` implements the existing v0.3 proposed view DTOs, not a new economic
rule. `memberData.ts` checks qualification/month identity and parses all real views:
qualification list, Person, dashboard, Sponsor, Binary, performance, awards, ledger,
products and orders. Unknown extra fields are tolerated; required fields/types are
not coerced. Unknown nonempty rank strings are displayed for forward compatibility.
Award lifecycle states must match the declared frontend contract or fail visibly.
Dates remain display strings; only YYYY-MM query-format is validated. This does
not settle EPV timezone, operational calendar, recognition or cutoff semantics.

Display numbers must be finite and within JS safe-number magnitude. Products use
nonnegative price/PV and tree counts use nonnegative safe integers. Signed ledger
adjustments and signed performance values are allowed; null is never coerced to zero.
This is not arbitrary-precision monetary computation. If backend returns decimal
strings, confirm a deliberate adapter/decimal representation instead of silently
converting them to numbers. Formal quote/payment accounting remains server-owned.

Duplicate IDs fail as a whole response to prevent unstable keyed UI rows. Errors
are routed through existing resource error/retry states; no mock fallback occurs.
Parsing does not establish object ownership or replace server-side BOLA/IDOR tests.
Pagination, payload limits, live contracts and browser/LIFF UAT remain pending.

## Verification

54 executable Vitest cases pass: 29 retained, 17 validator cases, 7 session cases,
and one malformed-catalog UI regression. TypeScript/Vite build pass. No dependency
additions or backend changes. Browser UAT is unverified due to the prior absent
Chromium executable; neither server security nor production gates ran here.
