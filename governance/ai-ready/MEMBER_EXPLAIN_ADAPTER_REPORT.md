# Member Explain adapters — Active and original settlement Carry

Status: IMPLEMENTED; not deployed. Source starting baseline: 462930c; integrated upstream e686be8 provider runtime changes before final submission, without editing those files. Continuation is within the user's explicit development authorization. No Company Sponsor graph, plan/rank, migration, provider connection or release decision is implied.

## Endpoints

Both require the existing opaque Member LINE session and explicit owned Qualification context; unknown query fields are rejected. Responses use the existing data/meta envelope and Cache-Control: no-store.

| GET route | Required query | Available result |
|---|---|---|
| /api/v1/member/explain/active | qualificationId | Verified current positive Active; active=true, ownerType=MEMBER, reasonCode=THRESHOLD_MET, evidence/version references |
| /api/v1/member/explain/binary-carry | qualificationId, settlementBatchId | Exact decimal leftCarry/rightCarry from the original sealed FINALIZED BINARY_K1 batch |

This adds a separate shared explainBinarySettlementCarry tool/definition, scoped by Qualification + settlementBatchId. Existing explainBinaryCarry still requires an authoritative tree ID and period; it remains unconnected. A missing tree model is not replaced with a fake identifier. The new read is explicitly ORIGINAL SEALED evidence, not the latest replay-corrected Carry. Source periodEnd and hash references remain visible.

## Authority and authorization

The controller uses MemberAuthenticationGuard and MemberContextGuard. Service resolution additionally rereads AuthSession, LINE identity binding and Person status before/after the source read; permissions are fixed by this server integration, never accepted from query/model roles. The request's explicit qualificationId is the selected Ball for that request; this does not create persistent UI selection state. Clients must still cancel/suppress responses when switching UI context.

Authorization requires currentHolderPersonId and exactly one effective holder-history row to agree with the authenticated Person. Known system-assignment pool Balls are excluded from this Member-only adapter. This is a conservative restriction, not a complete new Company ownership model. Checks run before the source, inside its repeatable-read transaction and again before release. No source/other-recipient fields are exposed on denial. Current ownership grants the same Ball-scoped historical Carry access as existing Member reads; no former-holder identity/PII is included.

Source transactions have maxWait 500ms and timeout 1500ms; shared source deadline is 2000ms. Abort signals are checked before/after the transaction. Authentication/authorization/audit I/O retains existing database infrastructure behavior; this is not a claimed end-to-end SLA. Resource/session rechecks reduce stale results but do not replace a future transaction-wide authorization/version protocol.

Domain audit writes MEMBER_EXPLAIN_READ with actor, Qualification, tool/version/outcome and correlation. It stores no source payload, token, raw prompt or LINE subject. Audit persistence failure suppresses the result. Existing application HTTP audit middleware remains separate and unchanged. The endpoints are read-only for domain/economic data; audit insertion is intentional.

## Active limits

The adapter verifies ActiveIntervalEvidence → QualificationMonthAccumulatorEvidence → ConsumptionRecognitionEvent links, qualification/month/rule agreement, interval boundaries, original evidence hashes and a unique matching ActivePeriod. It accepts only the existing R1.0B NT$2,000 evidence basis. It does not recompute consumption, threshold crossing or awards.

Missing evidence is not evidence of inactivity. This first adapter returns 422 HISTORICAL_UNAVAILABLE for missing/ambiguous intervals, unsupported supersession/replay history or a month containing replayed accumulator evidence. Known system-pool Ball access is denied with 403. A stored 1,200 threshold is rejected rather than silently repaired. Company Always Active needs the future approved ownership adapter; it is not inferred from a name or system-pool record. The existing Member dashboard/Core behavior is unchanged.

The parameterVersion field for Active is the stored source consumption parameter-snapshot hash; this read does not fetch/reinterpret parameter definitions or claim to have reproduced the calculation. Unsupported asOf/knowledgeCutoff is rejected as an unknown query field.

## Carry limits

The source validates finalized batch metadata and the sealed replay envelope/parameter hash using the existing verifier, then requires exactly one Carry recipient matching the authorized Ball. Other recipients are projected away. Shared validation rejects null/numeric/noncanonical/negative Carry, mismatched scope and nonfinalized facts. No JS Number conversion occurs, so large decimal strings retain precision. Missing/draft/absent-recipient sources return 422; corrupt evidence returns 503 INVALID_EVIDENCE; failures have no current-state or zero fallback.

## Verification

- Member Explain HTTP integration: 22 tests PASS. Actual Nest routing, DTO validation, guards, shared gateway and service/source adapters; Prisma/token-provider dependencies are deterministic mocks. No live database fixture test is claimed.
- Adjacent existing Member Binary read model: 9 tests PASS; combined targeted run 31/31.
- Shared regression suite: 68/68 PASS; existing tree-scoped simulator contract remains compatible.
- API build: PASS after correcting initial systemAssignmentPool model-name compile error to systemAssignmentPoolEntry.
- OpenAPI export/preflight, security preflight and TODO gate: PASS.
- New routes expose exact response schemas and existing memberBearer authentication in backend/openapi.generated.json.

No schema/migration, Core arithmetic, existing Member read endpoint, frontend, LLM provider or Stage/Production deployment changes. Initial foundation report remains a historical record; this report supersedes its statement that all production-source adapters are still unconnected. Reservoir B remains unconnected. Next work is replay-aware/negative Active explanation and further authoritative Explain tools, with separately reviewed evidence semantics. Production remains BLOCKED.
