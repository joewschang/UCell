# Phase 1 Codex repair runbook

This implements the G8 repair contract. It governs diagnosis and code repair; it never authorizes direct Production mutation.

1. Open or update a sanitized GitHub Issue containing environment, release/git head, controlled error code/fingerprint, UTC first/last seen, count, sanitized trace references, expected/actual behavior, privacy class, reproduction status, severity and affected gate.
2. Attach only the least diagnostic evidence necessary. Exclude secrets, production credentials, raw database dumps, tokens and unrestricted member PII.
3. Classify the issue. Payment, placement, LINE identity/rebind, award/settlement/payout, return/recovery, privacy/security, migrations and data repair require human review. Ambiguous business meaning and bulk Production correction require a decision.
4. Reproduce in local or isolated Stage-compatible data where feasible. Add a regression that fails for the stated defect.
5. Make the smallest authority-consistent fix. Do not weaken Golden, security, privacy, OpenAPI or economic assertions.
6. Run focused, affected Golden/security/privacy, then broader regression based on impact. Commit/push to the authorized development branch or PR.
7. A governed release process decides Stage/Production deployment. Error monitoring may create evidence/Issues only; no error or Codex flow may mutate Production.
8. Close only after evidence, review and release disposition are recorded. Security/economic incidents are never auto-closed merely because errors cease.
