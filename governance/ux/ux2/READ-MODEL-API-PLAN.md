# Authoritative Operations Read Model plan

This is a proposed additive read contract, not an implemented API or a PASS claim. Existing Dashboard reads remain authoritative; absent metrics display unavailable.

Suggested endpoint: `GET /api/v1/admin/dashboard/operations`, using existing Admin session/RBAC. DTO sections carry `status: AVAILABLE | UNAVAILABLE | CONFIGURATION_PENDING`, `value: null` when unavailable, `asOf`, `source`, `scope`, and effective parameter/rule evidence where applicable. Never infer missing monetary amounts as zero. No mutation, settlement execution or ledger posting occurs on GET.

| Section | Authoritative source needed | Current constraint |
|---|---|---|
| Person New/Active/Suspend/Lost | approved Person lifecycle/NASL read model | Must not substitute Qualification Active for Person lifecycle. No approved aggregation definition implemented here. |
| Qualification New/Active/Exception | Qualification lifecycle and temporal Active evidence | Specify period and effective snapshot; current flag is not historical Active. |
| Orders/GMV/payment/returns | Core order/payment/return facts | Business-day boundary uses versioned Asia/Taipei parameter. Pending PV/BV mapping must not be inferred. GMV currency/status inclusion must have SSOT. |
| Organization health | separate Sponsor/Binary evidence | No placement mutation; imbalance/alert thresholds need approved definitions. Do not merge tree semantics. |
| Settlement pipeline | exact settlement batch, period, rule and parameter evidence | Provide status/hash/input/output/exceptions/executedAt only when stored evidence exists. Current theory is not final payout. Operational cut-off remains pending. |
| Exceptions/security | authorized exception and security-event read models | Restrict sensitive details by existing RBAC, document completeness/window and pagination. No fabricated alert counts. |

Required implementation tests: exact source/currency/period boundaries, null/unavailable states, role denial, repeated GET with no monetary side effects, temporal consistency, page validation and OpenAPI errors. Production calendar/cut-off must remain configuration pending until approved. Backend changes can be implemented additively when source semantics are established; this UX phase does not invent those definitions.

Implemented UX-2 additive read API is narrower: exact paginated Qualifications currently owned by a Person. It does not claim to implement the proposed operations aggregate.
