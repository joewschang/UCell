# Member render error recovery

AppErrorBoundary wraps the router and bootstrap. A React render/lifecycle error
unmounts the member subtree, expires the local SessionGuard, cancels registered
requests and attempts removal of owned session keys. The fallback shows only a
generic message and an explicit reload button, never exception contents.

Reload restarts the existing bootstrap; real authentication remains fail-closed.
This is not LINE logout, server token revocation or cancellation of real orders.
Draft/demo state is discarded. No automatic reload loop or request retry exists.

Scope: React descendant render/lifecycle failures. API errors retain their current
resource handling. Event-handler errors, unhandled async errors and errors in the
boundary itself are not covered by this boundary. No external telemetry is added.

Validation: 82 tests PASS (79 retained, 3 new), TypeScript and Vite build PASS.
Tests cover healthy content, private-view unmount, request abort, hidden exception
details, blocked storage and explicit reload. Browser CI exercises normal flows;
render-failure injection is covered by component tests, not real-device LIFF UAT.
No backend/business-rule edits, main merge or production deployment.
