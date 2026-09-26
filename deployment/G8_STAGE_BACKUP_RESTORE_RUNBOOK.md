# G8 Stage backup and isolated restore runbook

**Status:** `IN_PROGRESS` — an isolated Stage PITR restore drill is running; this is not a claim that restore verification has passed.

## Current capability

- Source: `ucellstage-pg-5mafbbsq33mgu`, Azure PostgreSQL Flexible Server 16, Burstable `Standard_B1ms`.
- Automated point-in-time recovery retention: **7 days**.
- Azure does not permit customer on-demand backups on this Burstable SKU.
- A restore must create a separately named server in Stage scope; it must never target, overwrite, or be promoted over Stage or Production.

## Controlled procedure

1. Record source server identity, UTC restore point, retention, and current migration identity.
2. Restore to a unique `ucellstage-g8restore-*` server in the Stage resource group.
3. Use an existing secret only inside the controlled verification job; derive the restore hostname inside that process. Do not print, copy, or persist the URL/password.
4. Verify migration ledger, critical audit schema, and append-only trigger set.
5. Run only read-only critical integrity checks against the restore target.
6. Record elapsed provisioning and verification time, then delete the isolated target.
7. A failed verification is a restore failure; it never authorizes a retry against Stage/Production.

## Candidate targets requiring approval

`RPO <= 1 hour` and `RTO <= 4 hours` are assessment targets only. PITR supports point selection within seven days, but no RTO claim is valid until the isolated drill records elapsed provisioning, connection and verification time. Business approval is still required.
