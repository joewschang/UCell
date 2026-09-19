# P0 and Train D execution order

**Revalidated 2026-09-19:** regression started from synchronized `24ee46bccf405b2dd4bca1098c5b4e7c1157928a`. There are 69 migrations, 162 OpenAPI paths, 175 operations and 80 schemas. Local Docker PostgreSQL is healthy at `127.0.0.1:5432`; isolated migration suites use disposable `ucell_jest_*` databases.

| Order | Deliverable | Status and exit evidence |
|---:|---|---|
| P0.1 | Member Number, Ball Number and binary-position data model | Local gate PASS. Migration, allocator, immutable/unique constraints and derived path/Ball Number are implemented. Fresh 69-migration isolated DB test passes; migration 69 fixes natural growth beyond six ordinal digits. |
| P0.2 | Authoritative topology and legacy reconstruction | In progress. Forward writes and fail-closed reconstruction are implemented. Dry run, anomaly report and historical/replay DB tests are pending. |
| P0.3 | Member-safe tree and privacy boundary | Local regression PASS. Separate member DTO, snapshot cursor, bootstrap boundary, owned-subtree authorization and privacy assertions are implemented; Member tests prove internal Qualification/order IDs are not rendered. Formal credential-backed identity verification remains external. |
| P0.4 | Human-readable Member/Admin identifier UX | Local UI gate PASS. Member header, switcher, lazy tree, qualification presentation, Admin Person/Ball 360 and placement flows use business identifiers; Admin 96/96 and Member 149/149 pass with both builds. |
| P0.5 | OpenAPI, security and performance gates | Partial PASS. OpenAPI 175 operations, Security policy, RC isolated and Decision v3 17/17 pass. Formal credential-backed HTTP security remains externally blocked; the user excluded the large scale matrix from this execution. |
| P0 gate | P0 closure | Blocked until P0.1–P0.5 database and security evidence pass. No Stage action before this gate. |
| D.1 | Member Experience v2 | Implemented local checkpoint: Home, Organization, Money Journey and safe Explain use the final contracts; 149 tests and build pass. |
| D.2 | Admin Experience v2 | Implemented local checkpoint: Person 360, Ball 360, Tree Viewer, placement, settlement, return impact, Reservoir Center and analytics are present with RBAC states; 96 tests and build pass. |
| D.3 | Golden journeys and accessibility | Queued after P0 gate: 390/768/1440, 200% zoom, snapshot/race journeys and all audience-specific export/notification checks. |

The source attachment is unavailable after section 101; any requirement past that point is `SOURCE_NOT_AVAILABLE` unless Issue #2 or a governance source establishes it.
