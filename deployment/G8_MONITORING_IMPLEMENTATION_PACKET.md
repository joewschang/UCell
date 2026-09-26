# G8 monitoring implementation packet

**Status:** `DECISION_REQUIRED_RECEIVER_OWNER`.

The technical surfaces and Kusto queries are defined in `G8_MINIMUM_MONITORING.md`. When a named owner and delivery-capable Action Group are approved, create alert rules for:

- API health and 5xx/database connectivity;
- Worker unhealthy/restart and `WORKER_*`/`PROVIDER_*` failures;
- Payment/provider inbox failures;
- Placement failures and overdue placement evidence;
- Award, Return, Replay and Recovery failures;
- LINE link/rebind/provider errors;
- ERP handoff errors when that integration is enabled.

Each alert must contain only controlled code, severity, revision/release, trace ID and fingerprint. No recipient, Action Group ID or escalation target is invented here.
