# Member / LINE OA and Admin functional inventory — 2026-09-16

Branch integration/member-backend-mvp. This inventory distinguishes completed UI/API work from unfinished Backend engineering, operational prerequisites and future integrations. No Production readiness is claimed.

| Surface / function | Current result | Remaining requirement |
|---|---|---|
| Member LINE/LIFF login | Server verifier, identity binding lookup, opaque session, invalid/expired/replayed/unbound denial implemented | Formal LINE channel/LIFF configuration, real-device journey and signoff |
| Member Ball switching | Added actual POST context validation; private views hidden until confirmation; denial/unmount fail closed | Formal device UAT |
| Member Person without Qualification | Added own account/profile and local/server-session end access without scoped reads | Unbound accounts still denied; no self-binding policy invented |
| Member Dashboard/repurchase | Existing Core status plus new scoped recognition details, Core dueAt display | Production scheduling configuration and Backend scheduling refactor |
| Member Organization/Performance/Bonus/Ledger | Existing separated/scoped Core views and pending/null semantics verified | Complete Backend replay/carry convergence and approved source events; no client computation |
| Member Products/Orders | Existing connected creation/detail with authoritative prices and retry; Admin-created product profile hash now traceable | Existing legacy profiles without evidence remain configuration pending; no historical backfill |
| Member Notifications/Profile | Connected read-state/contact APIs already complete; retained and reverified | LINE push excluded from MVP; no arbitrary publisher workflow |
| Member Logout | Added authenticated UCell-session revocation + atomic audit, retry/rollback/concurrency and other-session isolation | Not a LINE logout; formal credentials still pending |
| Member mobile UI | Seven-route mock mobile browser smoke PASS, 320/390/768px, no writes; Windows Edge/temp-path infrastructure fixed | Connected real LIFF browser UAT is NOT substituted by mock smoke |
| Admin Subscription page | Replaced raw JSON workbench with bounded/filterable Core plans/list/schedule details and error/empty/retry states | Create/cancel remain unavailable in this page: Backend UTC schedule construction must become versioned scheduling; cancellation idempotency/rollback and formal operational dates/refund verification remain incomplete |
| Admin mutation transport | Failed retry retains key, identical concurrent submissions coalesce, actor change aborts queued work, timeout and domain errors presented | In-memory active-session retry only; reload recovery and endpoint-specific idempotency outside existing Core contracts are not claimed |
| Admin Orders/payment | Core amount display; stable payment request timestamp/key; removed client monetary totals | Formal authorized payment/reconciliation operational validation |
| Admin Returns/replay | Server cumulative remaining reversible quantity, abort stale selection, remaining limit display; Core return aggregate replaces client sum | Complete Backend K1/K2 period-wide/carry replay; historical/configuration absence still fails closed |
| Admin Products | Pending-save/error/retry states; new profiles obtain parameter hash; existing rate change rejected instead of silently ignored | Approved prospective profile version workflow is not invented; existing profiles immutable |
| Admin reports/dashboard | Query loading/error/retry; CSV errors and pending guarded; no stale failed result shown | Operational signoff/data completeness |
| Admin authentication/cache/routes | Cache cleared on login/logout/role/DEV actor change; authenticated 404 page | Formal Entra/RBAC HTTP security credentials/tests and UAT |
| Existing Admin applications/qualification/organization/workflows/payout/documents/audit | Existing routes retained; live local HTTP suite reverified | Formal Security/UAT, non-empty complete payout/return release evidence and Backend TODOs |
| Payment gateway / ERP stock / shipping / LINE broadcast | Explicitly unconnected future boundaries | External integrations outside current MVP; no fake success added |

CODE COMPLETE applies to the Member MVP adapters and the specific Admin read/transport fixes above, not all Backend engineering. CONNECTED DEV PASS is supported by final gate logs. OPERATIONAL CREDENTIAL PENDING, UAT PENDING and PRODUCTION BLOCKED remain separate statuses.

Pending Decisions: eligible-consumption complete scope; formal PV/BV event mapping; production operational calendar/cut-off. Asia/Taipei and historical snapshot fail-closed are settled. Backend TODO 73, K1/K2 period-wide replay and carry convergence/maxWeeks/resume remain unfinished. No TODO removed/skipped/faked by this UI batch.
