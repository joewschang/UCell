# V1.2 System Assignment — 2026-09-17

Status: NR-DEC-001/002 IMPLEMENTED AS AN ADDITIVE, VERSIONED ADMIN WORKFLOW. No Production policy or pool is seeded.

Migration `20260917042000_v12_system_assignment` adds versioned policy, explicit pool entries and append-only assignment evidence. The implementation accepts only the approved strategy identifiers: explicit pool, smallest descendant count, priority/enable-time/stable-ID tie-break, hard descendant capacity, effective Qualification exclusion and advisory-lock revalidation. Missing, inactive, unsupported or exhausted policy configuration fails closed.

`POST /api/v1/admin/qualifications/system-assigned` creates a Qualification only when the Person has no valid active Referral Attribution. The selected system root becomes Sponsor; Binary placement uses deterministic breadth-first traversal with left before right. Serializable transactions, a policy advisory lock, existing Sponsor sequence locking and binary slot constraints protect concurrent execution. PostgreSQL serialization conflicts return `RETRYABLE_CONFLICT` for same-key retry.

Fresh DB Golden verifies all 34 forward migrations plus 8 dedicated DB assertions: concurrent requests converge through idempotent retry, root left/right then left-subtree-left BFS order, unique Sponsor/Binary rows, append-only policy evidence, lost-response replay and referral exclusion. The fixture policy is explicitly `TEST_ONLY`; Promotion must provide separately approved Production policy rows and pool membership.
