# G8 operational recovery runbook

This runbook applies the smallest safe recovery action. It does not authorize Production mutation, data correction, or a Stage/Production deployment. Keep secret values in Key Vault or approved secret stores; never paste them into tickets, logs, or this document.

## 1. Triage and evidence

1. Record environment, release image digest/revision, UTC time, `x-request-id`, `x-correlation-id`, safe business identifiers, and the operator.
2. Query the protected Admin operational views and platform logs. Do not export raw request bodies or unrestricted member data.
3. Classify: application release, data/business record, database/storage, provider/payment, LINE identity, ERP handoff, or security incident.
4. Preserve immutable business/audit evidence. A remediation must create a new governed correction/recovery fact; never rewrite an Award, return, payment, placement, or audit fact.

## 2. Backup and isolated restore verification

**Owner:** Release/DB operator. **Target:** an isolated disposable database only.

1. Confirm the source database backup/PITR retention and capture its release identity.
2. Create or obtain a custom-format backup through the approved DB operation; write its SHA-256 sidecar.
3. Provision an empty isolated restore target. Never restore into Stage/Production.
4. Run `deployment/restore-verify.sh <dump>` with `RESTORE_DATABASE_URL` and `EXPECTED_MIGRATION_COUNT` injected only into the process environment.
5. Record: backup reference, checksum, restore target class, migration count, critical-schema result, Golden/smoke result, operator, timestamps.
6. Destroy the disposable target after evidence is retained. If verification fails, classify `DB_BACKUP_RESTORE=FAIL` and escalate; do not retry against a live environment.

## 3. Application release rollback

A bad release is an application rollback, not a database restore.

1. Stop rollout and capture active/previous revision and digest.
2. Confirm prior revision passed its health, privacy, and required release checks.
3. Shift traffic only to the prior digest-pinned revision using the governed Azure release operation.
4. Verify API health, worker health, Admin/Member access, and the affected business path.
5. Retain incident and release evidence. Do not run destructive data remediation as part of rollback.

## 4. Data recovery escalation

- Single business record error: use the domain-specific forward correction, return/recovery, reversal, or approved review flow.
- Corruption: stop unsafe writers, preserve evidence, obtain incident/data-owner approval, and use PITR or isolated restoration validation.
- Database loss: invoke the approved restore plan. Do not choose RPO/RTO, recovery point, or write-back scope without owner approval.

## 5. Payment and pending placement

1. Look up payment/order/qualification using safe business identifiers and correlation context.
2. Confirm provider evidence, receipt, Payment state, `PLACEMENT_PENDING`, and placement audit facts.
3. Retry only the approved idempotent provider/worker action. A failed placement must not allocate a Ball or activate the Qualification.
4. Escalate payment reversal/refund and placement override to the authorized Finance/Membership operation roles. Preserve evidence.

## 6. LINE account compromise or rebind

1. Revoke the affected session/binding through the governed account-security flow.
2. Verify the security audit timeline and identity-link state.
3. Require the authorized rebind review/completion flow. Never overwrite an existing binding or create a duplicate Person as an operational shortcut.
4. Notify the member through approved channels without exposing tokens or identity data.

## 7. Award, return, and recovery dispute

1. Read stored Award/Settlement/Payable/Return/Recovery evidence and historical snapshots.
2. Do not recalculate historical results from current SKU, Active, or rule configuration.
3. Use append-only return/recovery/correction mechanisms; paid outcomes remain traceable through recovery.
4. Escalate any monetary correction for required human review.

## 8. ERP handoff failure

1. Inspect provider outbox/inbox state, safe correlation reference, retry classification, and configured handoff boundary.
2. Retry only idempotent approved messages. Do not create a parallel fulfillment or ERP record manually.
3. Record unresolved failures for the integration owner. ERP is unavailable until explicitly configured.

## 9. Security or data incident

1. Contain access: revoke session/identity where appropriate; do not destroy evidence.
2. Preserve sanitized diagnostic facts and protected audit references.
3. Escalate to the named security/data owner. Never place credentials, tokens, raw PII, or database dumps in GitHub/Drive/tickets.
4. Any code repair follows the G8 repair workflow: reproduce, regression evidence, minimum fix, affected gates, review, governed deployment.
