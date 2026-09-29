# Period-close Admin operations checkpoint — 2026-09-29

The existing governed PeriodCloseJob and Worker execution remain the monetary authority. This checkpoint adds an authenticated list/read surface and a bounded manual requeue command; it does not execute settlement inside the browser and does not enable the Worker in any environment.

Compliance Audit can read recent job status. Finance and Super Admin can requeue an incomplete PENDING, expired PROCESSING, or DEAD job with a required reason. The command locks the immutable job, rejects an active lease or completed receipt, resets only Outbox delivery state, and writes `PERIOD_CLOSE_RETRY_REQUESTED` in the same Serializable transaction. The Worker still revalidates prerequisites, parameter snapshot, lease fencing, and result receipt before monetary commit.

The Admin page shows kind, period, rule, approval reference, status, attempt count and availability/completion time. It deliberately hides job/source/snapshot UUIDs, lease ownership and raw failure text. Compliance retry is disabled in the UI and denied by API RBAC.

## Evidence

- API production build PASS.
- Admin typecheck and production build PASS.
- Admin navigation/role tests: 2 files / 8 tests PASS.
- Focused isolated PostgreSQL and HTTP RBAC: 2 suites / 15 tests PASS; fresh 0→108 migrations, 162 database assertions and cleanup PASS.
- Tests prove Finance audited requeue, completed-job rejection, Worker completion after requeue, Compliance read-only access and malformed request rejection.

Calendar planning, explicit late-input policy, Welfare/Payable sequencing and final full regression remain separate closure work. No Stage or Production deployment occurred.
