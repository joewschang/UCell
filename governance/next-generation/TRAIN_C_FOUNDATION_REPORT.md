# Train C analytics foundation

Backend foundation and local/isolated gates PASS. No full Dashboard redesign or AI subsystem is included.

Immutable period generations/rows implement Tree, Founding Ball, Return, Rank, Bonus, Active, Reservoir, Carry and K read models. They record dataThrough, projectedAt, projectionVersion, query/snapshot identity and status. The source aggregate hash is an output reconciliation hash, not a cryptographic hash of every input fact. PostgreSQL snapshot identity and source provenance are retained.

CURRENT / UPDATING / REBUILDING / STALE / FAILED states are explicit. Non-current reads cannot claim complete current results. Fixed Train A MetricDefinition / AnalyticsQuery / AsOfContext / DataClassification / EvidenceEnvelope adapters reject arbitrary SQL, unknown metrics and unsupported filters.

Adapters: POSTED recognition-cohort Order/Amount/Product/Tree/Founding return rates; historical Ball rank distribution, Active/GPV/Bonus by rank, every first rank achievement in period; Active Rate; configured Ball bonus bands; Tree Comparison/new placements; authoritative Carry/Pair PV; K0/K1/K2 sealed outputs/replay revisions; separate A/B. Zero return denominators yield null. Company entitlements are excluded from Member distribution. Missing historical status/owner, unfinalized GPV, broken Return lineage or pending financial replay causes explicit incomplete/stale evidence.

Jobs support tree/founding/period/metric scope, DRY_RUN, REBUILD and RECONCILE. Immutable actor/query identity, queue bounds, leases and latest-request publication fence prevent cross-actor mutation or stale overwrite. Concurrent workers and expired-lease retries are tested. Projections never overwrite authoritative facts.

Export jobs support REQUESTED/RUNNING/COMPLETED/FAILED/EXPIRED, captured query/generation, bounded 500-row reads and ≤1 MiB CSV chunks, formula escaping, provenance and actor authorization on every download chunk. Downloads expire after 24 hours. Physical retention policy for immutable generations/chunks is DEFERRED; no automatic destructive cleanup is introduced.

Dedicated period-projection-worker.mjs supports bounded operator runs and --watch (poll 1000–60000 ms, default 5000), separate from the monetary worker. Stage worker hosting remains a deployment review item. Six APIs and response/error schemas are in the generated OpenAPI artifact. Native CSV streaming, RBAC/BOLA/revocation, rebuild/reconcile and replay source tests pass.

Next Rank Pipeline remains SOURCE_NOT_AVAILABLE until authoritative progression evidence is sufficient. Unmatched truncated attachment content is SOURCE_NOT_AVAILABLE, not invented. See TREE_SCALE_REPORT.md and evidence/final-validation.json. Stage STOP; Production BLOCKED.
