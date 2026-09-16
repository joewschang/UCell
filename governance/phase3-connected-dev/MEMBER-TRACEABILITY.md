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

## Connected MVP closure (supersedes preceding unfinished Member entries)

Pre-change b64a31a; implementation preserved 1639bd5. Core-priced Member order recording is distinguished from payment/PV recognition and physical fulfillment. The existing authoritative Core computes order facts from a single effective R1.0B profile; missing/ambiguous profile fails closed. Client price/PV/purpose cannot enter the order DTO. Pending formal event mapping is not inferred or enabled by this order API.

Idempotent Serializable order/profile/read mutations revalidate owner/state and preserve audit/transactional outbox atomicity. Source-event unique station notification and owner-bound first-read evidence are engineering persistence mechanisms, not a LINE push policy. Profile edits remain Person-only. Read adapter uses the established initial CALCULATED to PENDING_45D transition for equal timestamps; other conflicting evidence fails closed instead of guessing chronology. Historical award/ledger/PAID facts are untouched.

183 isolated HTTP/DB assertions twice, 99 Member tests and 129 replay DB assertions validate this checkpoint. One existing RPV anchor TODO was converted with actual DB assertions; 73 remain. Synthetic LINE verification is test-only. Formal LINE/Entra/browser UAT/Production evidence remains blocked. Earlier checkout/read-state pending entries describe superseded engineering incompleteness, not new commercial decisions.

## Functional gap closure traceability

Pre-change checkpoint d4f0e99. Context switch is a server authorization check, not monetary mutation; every scoped request still independently rechecks temporal ownership. A Person without Qualification can access only Person-level account/contact/session controls. Server logout revokes the authenticated UCell LINE session ID supplied by the trusted principal; client-submitted identities/session IDs are rejected and other sessions are unaffected. Revocation/audit/idempotency share one transaction, and revoked-bearer retries deny 401. No claim of LINE logout is made.

Prospective new ProductRuleProfile parameter hashes come from existing versioned R1.0B Core parameters; no current-state hash is backfilled onto an old profile. Existing-rate changes reject VERSIONED_PRODUCT_PROFILE_REQUIRED and rollback all product writes. Formal PV/BV event mapping is not inferred. Admin order amount display and return totals use Core values; remaining reversible quantity uses the same cumulative POSTED-return predicate as ReturnService, while actual return mutation independently enforces caps. Read-only subscription UI exposes the unresolved Backend scheduling/calendar/cancellation work rather than enabling legacy writes.

Additional evidence: Member 106 tests / 201 HTTP-DB assertions twice, Admin transport/query/session-boundary tests, actual Admin HTTP and browser reads. Mock mobile screenshot is explicitly demo UI. Formal LINE/Entra/UAT credentials and 73 Backend TODO still block production.
