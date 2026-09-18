# Train A supported reads and limits

The Shared definitions, gateway and local simulator are provider-free. They do not connect an LLM, execute SQL supplied by a caller, ingest documents, or create embeddings. No economic writer or historical migration is changed.

| Tool | Authoritative source / supported result | Deliberate unavailable or partial cases |
|---|---|---|
| getActiveStatus / explainActive | Existing verified consumption/accumulator/interval adapter; original member state at asOf | Missing or revised/replayed evidence; unknown tree; records learned after knowledgeCutoff |
| explainPerformance | Complete bounded PvLedger selection; exact decimal aggregation by GPV/RPV/EPV | Empty population, more than 100 rows, mixed/missing parameter versions, reversals requiring restatement |
| explainBinaryCarry | Exact sealed BINARY_K1 snapshot for selected Ball and batch; PairPV and output Carry | Missing PairPV, unsealed batch, later finalization, replayed Carry, inferred legacy tree |
| explainAward | Immutable BonusAward Theory/K/Final with stored parameter version | Another Ball, absent historical fact, unbound parameter version; no recomputation of Final |
| explainSettlement | Owned recipient's sealed original FINALIZED batch status | Other recipients' or global pool amounts are never projected |
| explainPayout | Original PAID PayoutLine net with payment audit's recorded time and original BonusAward versions | Pre-payment/missing audit, mixed versions, unsupported Global/RPV source joins, more than 100 entries |
| explainReturnImpact | POSTED return's audited amount and original order rule snapshot | Replay status is explicitly UNAVAILABLE; envelope is PARTIAL, never VERIFIED for full replay impact |
| explainReservoirA | Stored signed A accrual/correction with original Global snapshot | Missing source/version; Finance/Super Admin/Compliance live Entra grant required |
| explainReservoirB | Contract and activation boundary | Always NOT_ACTIVATED; source never invoked |
| getTreeStats | Contract and tree scope boundary | NOT_ACTIVATED until Train B source exists |
| queryMetric | Registered metric, permission, dimensions, bounded filters/limit/pagination/comparison contract | No production execution adapter in this foundation; explicit UNAVAILABLE, never fabricated zero |
| lookupKnowledge | Approved local document/unit metadata with parent version/hash/authority and effective/recorded/approval time | No document corpus is implicitly approved; draft/superseded/ambiguous/late/forbidden data is excluded |

HTTP: GET /api/v1/member/explain/structured; GET /api/v1/admin/explain/reservoir. Schemas declare supported fields. Both use no-store and safe audit metadata. Existing Active and sealed Carry endpoints remain available. Member permissions are server constants backed by a current session, identity link, current holder, exactly one effective holder interval and exclusion of the system assignment pool. Selected Ball is the guarded HTTP request context, never a model-supplied role or permission. Admin reservoir reads require current Entra session/link/grant before and after the read; local development bypass is insufficient.

Time is canonical UTC ISO text interpreted with Asia/Taipei business periods; effective event selection uses [periodStart, periodEnd), before asOf, recorded time <= knowledgeCutoff. Dates do not substitute for missing historical evidence. A superseded source may become unavailable conservatively rather than being reconstructed from present state.

The canonical route catalog is a logical allowlist, not permission or a promise every destination exists. Explain envelopes retain null deep links until an authorized deployed destination is registered. IDs are encoded; arbitrary URLs and query parameters are not accepted.

The 24 questions in the Phase 1 Golden seed now have executable boundary mappings, plus focused successful-evidence/security tests. This is not a claim to have implemented the proposed 120-question answering corpus. Unregistered rank/NASL/distribution/rate metrics fail closed. The foundation does not expand those unapproved analytics semantics.

The test-only Award value 49.1234 with Theory 100 and K .5 intentionally verifies that readers preserve stored evidence. It is a synthetic read-projection fixture, not an R1.0B economic rule or result.
