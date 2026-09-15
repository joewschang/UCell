# Integrated Member engineering traceability — 2026-09-16

Authority: user's unified Integrated MVP instruction; no new business decision.

| Confirmed requirement | Implementation / evidence |
|---|---|
| Person 1:N Qualification; each ball independent | MemberService temporal ownership; MemberContextGuard; 87 isolated HTTP/DB assertions and two frontend contract bundles |
| Sponsor distinct from Binary | Separate relationship queries and recursive Binary count query; fixture Sponsor 2/0 versus Binary 1/2 |
| Historical snapshot fail closed | RPV/EPV volume reads verify archived replay envelope; missing or mismatched timezone evidence rejects; original-month reversal attribution |
| Frontend cannot determine monetary results | Read adapters consume persisted Core facts; null pending values; existing EPV/RPV services create explicit TEST_ONLY fixture facts |
| Unfinalized is not zero | Bonus read CALCULATED/unfinalized becomes PENDING/null; unsettled dashboard bonus null; unknown Binary volumes null |
| Server verified LINE identity | LineTokenVerifierService before binding lookup and opaque session issuance; provider boundary synthetic only in test app |
| Replay/idempotency and qualification authorization | Unique hash exchange evidence; Serializable transaction; duplicate exchange denied; foreign ball denied on all scoped reads |
| Existing Admin DEV cannot authorize Member | Member-specific guards remain mandatory; direct Member me without bearer returns 401 in live Local Admin DEV |
| Pending operational scope/calendar decisions | TEST_ONLY consumption/events do not approve scope/mapping/calendar; ERP inventory unknown means purchase unavailable |

Legacy Test Drift remains governed by preceding SA decisions. No monetary history, original award or PAID lifecycle is changed by these read/auth adapters. Tests do not prove formal LINE/Entra/UAT/Production credentials or complete Phase 3 replay/carry functionality.

## Member continuation traceability

Pre-change checkpoint bdac653. Profile API authorization derives Person only from the authenticated LINE principal; audited contact/display changes do not alter identity, legal name or monetary facts. Notification queries require temporal Qualification ownership and filter both Person audience and selected ball, never global notices inferred from other Persons. Schema migration adds station notification storage only; no LINE push or publication policy is assumed. Repurchase display reads actual recognition state and does not choose an operational cut-off. Client period default uses current approved Asia/Taipei; future parameter changes remain prospective.

Checkout is explicitly unimplemented financially: protected POST returns PENDING_DECISION after authentication/ownership/input validation, rejecting frontend monetary input. It never delegates Member requests to Admin CONFIRMED order creation. Formal mapping/checkout configuration remains a blocker. Additional 111-assertion journey proves notification/profile/checkout negative paths and missing historical evidence; TODO remains 74.
