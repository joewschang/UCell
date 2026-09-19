# P0 and Train D execution order

**Revalidated 2026-09-19:** `HEAD` and `origin/integration/member-backend-mvp` are `35bfef1b3d3134601b70990818fc620968dafa4c`; the working tree contains this uncommitted P0 implementation. There are 68 migrations, 162 OpenAPI paths, 175 operations and 80 schemas. Local Docker PostgreSQL is healthy at `127.0.0.1:5432`; isolated migration suites use disposable `ucell_jest_*` databases.

| Order | Deliverable | Status and exit evidence |
|---:|---|---|
| P0.1 | Member Number, Ball Number and binary-position data model | In progress. Migration, allocator, immutable/unique constraints and derived path/Ball Number are implemented. Fresh 68-migration isolated DB test and 32-way allocator concurrency test pass; legacy reconstruction evidence remains. |
| P0.2 | Authoritative topology and legacy reconstruction | In progress. Forward writes and fail-closed reconstruction are implemented. Dry run, anomaly report and historical/replay DB tests are pending. |
| P0.3 | Member-safe tree and privacy boundary | In progress. Separate member DTO, snapshot cursor, bootstrap boundary, owned-subtree authorization and raw DTO field tests are implemented. HTTP, search, Explain, notification, export and accessibility negative tests remain pending. |
| P0.4 | Human-readable Member/Admin identifier UX | In progress. Member header, switcher, qualification presentation and placement API now use business identifiers. Finish the member lazy-tree UI, Admin Person/Ball 360 and UUID-display audit. |
| P0.5 | OpenAPI, security and performance gates | Pending. Regenerate artifact, resolve the intentional memberNo contract correction, execute BOLA/IDOR/privacy tests, then run 10K/100K/1M scale evidence. |
| P0 gate | P0 closure | Blocked until P0.1–P0.5 database and security evidence pass. No Stage action before this gate. |
| D.1 | Member Experience v2 | Queued after P0 gate: Home, Organization, Money Journey and safe Explain using the final contracts. |
| D.2 | Admin Experience v2 | Queued after P0 gate: Person 360, Ball 360, Tree Viewer, placement wizard, settlement, return impact, Reservoir Center and analytics, each with RBAC. |
| D.3 | Golden journeys and accessibility | Queued after P0 gate: 390/768/1440, 200% zoom, snapshot/race journeys and all audience-specific export/notification checks. |

The source attachment is unavailable after section 101; any requirement past that point is `SOURCE_NOT_AVAILABLE` unless Issue #2 or a governance source establishes it.
