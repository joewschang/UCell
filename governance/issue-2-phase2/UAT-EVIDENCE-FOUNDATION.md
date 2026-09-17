# UAT evidence storage foundation

This additive foundation stores UAT execution evidence. It does not approve a scenario, sign off UAT, pass a release gate, or authorize Production promotion.

`LOCAL_ASSISTIVE_ONLY` identifies local or Connected DEV execution assistance. `FORMAL_UAT_EVIDENCE` identifies evidence produced in the governed `UAT` deployment. Formal ingestion fails closed unless `UCELL_DEPLOYMENT_ENV=UAT`, `UAT_FORMAL_EVIDENCE_INGESTION_ENABLED=true`, the authenticated actor has the `SUPER_ADMIN` API role, and a non-empty approval reference is supplied.

Both classifications are append-only. The database rejects `UPDATE` and `DELETE`; a correction is a new evidence record with its own hash and artifact reference. Formal sign-off semantics remain pending governance, and the write API always returns `formalSignOff: false`.

Every record contains classification, environment, scenario code, result, SHA-256 evidence hash, immutable artifact reference, actor, execution time, recording time, request ID and correlation ID. Formal records additionally require an approval reference. An `AuditEvent` is appended in the same serializable, idempotent transaction.

API authorization:

- `POST /api/v1/admin/uat-evidence`: `SUPER_ADMIN`, required `Idempotency-Key`.
- `GET /api/v1/admin/uat-evidence`: `SUPER_ADMIN` or `COMPLIANCE_AUDIT`.

The write path never changes monetary or business state. Evidence ingestion is not a UAT result adjudicator.

Database regression is executable with `backend/scripts/uat-evidence-db-test.mjs` against the isolated `ucell_admin_test` database. It asserts successful append, rejected update, rejected delete, and rejected formal evidence without an approval reference.
