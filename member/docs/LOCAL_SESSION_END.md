# Local session end — v0.6 follow-up

The account page offers a two-step local session end, with cancellation.
Confirmation calls the existing SessionGuard, aborts registered requests,
clears the three owned sessionStorage keys and unmounts the member subtree,
including qualification, commerce and notification state. Storage failures
must not prevent locking. The first termination reason remains authoritative.

This is not LINE logout, server token revocation, a cross-tab logout,
or deletion/cancellation of any real order. No logout endpoint is invented.
Reload runs the existing bootstrap; demo mode starts again. Real session
exchange and server revocation remain integration blockers.

Validation: 67 local tests PASS (63 retained, 4 added); TypeScript and Vite
build PASS. Browser smoke extended for confirmation, cancellation, member
view removal, selected-ball storage removal and demo restart. The CI result
must be checked against the exact published commit; local build is not UAT.

No backend or R1.0B rule changes. No main merge or production promotion.
