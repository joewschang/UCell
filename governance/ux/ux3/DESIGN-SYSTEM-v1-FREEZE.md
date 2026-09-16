# UCell Design System v1 — frozen rollout contract

Approved visual source: `436cbf7168bca53454f4f46ff2c8ac697464026b`. UX-3 freezes its semantic tokens, status mapping, typography, spacing, surfaces, app shells and interaction patterns as the product visual authority. Bootstrap remains grid infrastructure only. Future visual changes require an explicit versioned Design System change; routes may not introduce local brand/status colors.

Member routes use the mobile shell, global Qualification context, `MemberPageHeader`, shared Metric/Money/Status/Qualification/Lifecycle components and unified Loading/Empty/Error states. The current Award status alone may be emphasized; no earlier or future lifecycle stage is inferred.

Admin routes use the enterprise shell, shared PageHeader/status/error states, bounded `AdminDataGrid` and `AdminTable` adapter, drawer pattern and governed confirmation. Adapter sorting/search/pagination operate only on the explicitly loaded Backend page and state that limitation. Core rendered amounts/statuses and existing handlers remain unchanged.

High-risk action confirmation is an additional UI guard. Existing Backend authorization, idempotency and Audit remain authoritative. Where an endpoint has no reason field, the dialog states that its typed confirmation reason is not automatically persisted; UX does not fabricate Audit evidence. An additive reason/evidence contract remains an API gap.

No R1.0B formula, monetary status, ownership rule, historical snapshot, authorization policy or mutation payload was changed by this freeze. Missing NASL/GMV/Organization Health/Security/Settlement evidence remains unavailable under the UX-2 read-model plan.
