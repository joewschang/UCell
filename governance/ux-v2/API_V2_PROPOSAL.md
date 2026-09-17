# API v2 proposal

Status: SPECIFICATION ONLY, no routes deployed or generated OpenAPI changed. Current contracts are inventoried in [openapi-inventory.json](evidence/openapi-inventory.json); use `/api/v1` unchanged until reviewed adapters exist. Proposed namespace `/api/v2` below is additive. Domain and economic decisions remain [review-gated](PENDING_ARCHITECTURE_DECISIONS.md).

## Shared wire contract

Authenticated session resolves actor, role, Person and permitted tree/report scopes. Never accept actor authority from body, tree ID, a context token or a hidden UI button. Member endpoints assert current holder and owned Ball on every call; historical former-holder visibility requires existing explicit policy and is not expanded here. Admin finance gets masked Ball summaries, not general Person access. Capabilities supplement existing role guards; unspecified capabilities deny.

Request filters: `periodType=CALENDAR_MONTH|SETTLEMENT|BINARY_WEEK`, `periodId` or valid paired start/end, `binaryTreeId`, optional `foundingQualificationId`, `asOf`, `knowledgeCutoff`, `rankBasis`, `rank`, `active`, `productId|packageVersionId`, `basis=FINALIZED|PAID`, `limit` default 50/max100, cursor, allowlisted sort. IDs UUID; dates ISO8601 with offset. Server normalizes Asia/Taipei half-open periods. Reject conflicting dates, invalid founding/tree pair and unsupported metric/filter combinations (422); never ignore a filter. Unknown JSON fields rejected for commands. Search strings bounded to 120 characters; reason 1–1000; idempotency key 1–128. Decimal strings, never floating-point money.

```json
{
  "context": {
    "qualificationId": null, "binaryTreeId": "tree-id",
    "periodType": "CALENDAR_MONTH", "periodStart": "2026-08-31T16:00:00Z",
    "periodEnd": "2026-09-30T16:00:00Z", "timezone": "Asia/Taipei",
    "asOf": "2026-09-30T16:00:00Z", "knowledgeCutoff": "2026-10-02T00:00:00Z",
    "definitionVersion": "analytics-v1", "projectionGeneration": "generation-id",
    "sourceWatermark": "opaque-sequence", "computedAt": "2026-10-02T00:00:01Z",
    "contextToken": "signed-scope-snapshot-reference"
  },
  "metrics": {
    "monthGpv": {"value": "1200.0000", "unit": "GPV", "status": "AVAILABLE", "reason": null, "evidenceRefs": ["evidence-id"]},
    "paid": {"value": null, "unit": "TWD", "status": "PENDING", "reason": "NOT_FINALIZED", "evidenceRefs": []}
  },
  "pagination": {"nextCursor": null, "hasMore": false}
}
```

Illustrative values only. `AVAILABLE` with zero is valid only with complete source population. UNAVAILABLE has reason/missingEvidence; STALE retains watermark/lag. Null is never coerced to zero. Amount lifecycle and read freshness are independent fields. Hashes identify evidence, not authorization. Cursor binds normalized filters, sort+ID tie breaker, generation and authorization scope; changed context returns 409 CURSOR_CONTEXT_CHANGED. Expired generation returns 409 SNAPSHOT_EXPIRED and explicit refresh, not mixed pages. Member cache keys include session/Person/Ball/period; Admin include authorization scope/filter/generation. Private responses must not enter shared public caches.

## Member queries

| Method/path under v2 | Response and authority | Access / compatibility |
|---|---|---|
| GET /member/qualifications | Portfolio: Ball ID/code, plan, rankBasis, owner classification, Active interval, status | Current holder; paginate unlimited portfolio; preserve no-Ball flow |
| POST /member/context/qualification | Selected owned Ball and context version | Revalidate ownership; no monetary mutation |
| GET /member/today?qualificationId | Ball, eligible consumption, threshold, remaining amount, Active/from/to, next authoritative payout, performance, Binary summary, alerts, quick actions | Member-owned Ball; server calculates progress/remaining; existing dashboard adapter |
| GET /member/performance | GPV/RPV/EPV with selected period, evidence; no abstract BV value | Owned Ball; preserve v1 amount meaning |
| GET /member/organization/sponsor | Bounded historical Sponsor nodes/edges | Owned scope, masked identities, distinct source |
| GET /member/organization/binary | Nodes/edges + optional exact settlement Carry/Pair/cap context | No company finance, max100 nodes, expand via cursor |
| GET /member/bonus-journey | Source, type, amount or PENDING, actual lifecycle events, settlement/payout anchors, recovery links | Per Ball; never synthesize completed lifecycle stages |
| GET /member/evidence/{id} | Authorized explanation envelope | Same Ball/resource authority as source; no raw sensitive snapshot JSON |

Orders, delivery profile, package checkout, contracts/consent, notifications, content, profile and logout retain existing v1 command behavior. New shell routes may call those v1 endpoints directly. Switching Ball invalidates scoped queries before rendering and aborts/ignores older responses. No implicit Person-wide monetary aggregate.

## Admin commands and queries

Capabilities: TR=tree.read, TW=tree.manage, PW=placement.write, SR=stats.read, FR=finance.read, BR=reservoirB.read, AR=analytics.read, EX=export, AU=audit.read. Bind to approved existing roles in the statistics spec; no Member receives these.

| Method/path | Inputs beyond common envelope | Output / checks / capability |
|---|---|---|
| GET /admin/binary-trees | search, status, month, sort, cursor | List columns in statistics spec; TR; financial columns require BR |
| POST /admin/binary-trees | treeName, optional requestedTreeCode, effectiveAt, reason | 201 treeId/code, DRAFT, three company Balls, seven positions, revision, audit/outbox refs; TW; atomic bootstrap |
| GET /admin/binary-trees/{id} | asOf/context | Identity, status history, bootstrap, allowedActions, summaries; TR |
| PATCH /admin/binary-trees/{id}/name | name, expectedVersion, reason | New revision + audit; TW; no identity/topology edits |
| POST /admin/binary-trees/{id}/transitions | targetStatus, effectiveAt, expectedVersion, reason | New status event; TW; lifecycle matrix/preconditions |
| GET /admin/binary-trees/{id}/founding-statistics | month/asOf/knowledgeCutoff | Exactly four position rows, nullable occupancy and metrics; SR |
| GET /admin/binary-trees/{id}/company-statistics | period/asOf | #1–#3 rows, Always Active and B evidence; TR+BR |
| GET /admin/binary-trees/{id}/descendants | ancestorId, firstSide, cursor | Bounded historical nodes; TR; topology and first-placement evidence |
| POST /admin/placements/preflight | qualificationId, treeId, parentId, side, effectiveAt | valid, violations[], Sponsor evidence, expectedTreeVersion, expiring token; PW; no reservation |
| POST /admin/placements | qualificationId, binaryTreeId, binaryParentQualificationId, side, effectiveAt, expectedTreeVersion, preflightToken, reason | 201 placementId, actualEffectiveAt, immutable Sponsor reference, audit/outbox; PW; all checks repeated at commit |
| GET /admin/people/{id}/360 | allowed tabs | Identity + portfolio only as authorized; original Person permissions |
| GET /admin/qualifications/{id}/360 | tabs, period/asOf | Typed MEMBER/COMPANY view; per-tab capabilities; unavailable fields explicit |
| GET /admin/settlements/{id}/cockpit | context | Actual recognition/eligibility/K/pool/payable stages and provenance; FR |
| GET /admin/returns/{id}/impact | replayRevision | POSTED delta, historical Active/EPV/Awards/recovery; FR or allowed order role with monetary masking |
| GET /admin/reservoirs/a | period, cursor | A-only Global remainder effects; FR |
| GET /admin/reservoirs/b | tree/Ball/awardType/period, cursor | B-only effects, originals vs signed corrections; BR |
| GET /admin/reservoirs/b/{effectId}/explanation | context | Calculation -> owner -> destination evidence; BR |
| GET /admin/economic-reconciliation | settlement/source family | Separate destination totals with valid basis-specific equations and differences; FR |
| GET /admin/release-readiness | environment | Verified gate/blocker evidence; AU; no promotion command |

Commands use `Idempotency-Key` header and canonical request hash bound to actor/operation. Body actor is disallowed; server actor is persisted. Exact retry returns original status/body and `Idempotency-Replayed: true`. Different payload with same key =>409 IDEMPOTENCY_CONFLICT. expectedVersion prevents stale settings/placement. Tree code conflict never allocates a silently different requested code. PlaceQualification must preserve Sponsor evidence byte-for-byte. effectiveAt initially means server commit-time; arbitrary past/future values return EFFECTIVE_TIME_UNSUPPORTED (proposal). No DELETE tree, reparent, B outflow or AI mutation route.

Error envelope: `{error:{code,message,fieldErrors?,correlationId,retryable,evidenceRef?}}`. 401 session expired; 403 denied without resource leakage; 404 absent or concealed resource; 409 version/slot/key/conflicting effective state; 422 invalid domain/filter/history; 429 query quota; 503 incomplete projection/service. Historical missing evidence returns typed unavailable metric or 422 HISTORICAL_EVIDENCE_MISSING when the whole requested assertion cannot be established. Never return partial financial totals as complete. Preflight violation codes: PARENT_MISSING, SLOT_OCCUPIED, TREE_MISMATCH, CYCLE, SELF_PARENT, ALREADY_PLACED, BOOTSTRAP_LOCKED, TREE_NOT_ACTIVE, HISTORICAL_CONFLICT, SPONSOR_EVIDENCE_CONFLICT.

## Analytics contracts

GET `/admin/analytics/{domain}` where domain is executive, organization, performance, rank-talent, bonus, customer-quality, finance-governance. `report` is an allowlisted metric family from the BI dictionary. Return context, appliedFilters, supportedFilters, metric definitions, source completeness and summary/series/rows with cursor. All filters apply server-side BEFORE aggregation; unauthorized rows must not leak through totals, facets or exports. Advanced asOf/knowledgeCutoff needs audit permission. Expensive exact distribution query returns 202 queryId and GET `/admin/analytics/queries/{id}`; results pin a complete generation.

POST `/admin/analytics/exports` accepts contextToken, report, columns and format CSV, requires AR+EX and field-level capabilities, returns 202 exportId. GET `/admin/analytics/exports/{id}` returns job status and expiring private download only after reauthorization. Preserve same generation/filters/definitions/masking; if snapshot expired, fail explicitly. Escape CSV formula cells. Audit request/result hash, never credentials. No browser export from a single visible page claiming full totals.

Explain envelope: `{subject:{kind,id,qualificationId},summary,steps:[{label,status,value,unit,sourceRefs}],ruleVersion,parameterVersion,settlement,payoutCalendar,ownerAtEvent,destination,replayRefs,availability}`. Financial values already computed by Core; display and future AI may quote/navigate, never evaluate formulas to replace missing results. External content/evidence text is untrusted input; AI gets authorized redacted read tools only, no write credentials. Every generated explanation cites subject/time/evidence and abstains on missing evidence.

## Contract acceptance after review

OpenAPI DTO/schema examples must cover all statuses, decimal nulls, errors and capabilities; export parity and query budget tests; unauthorized forged tree/Ball/context/cursor/evidence IDs; exact retry and changed payload; two simultaneous slot commits; close-vs-place race; historic missing owner/tree; A/B isolation; out-of-order Ball responses; company never receives member payout; no unsupported filter silently omitted. Existing v1 client tests remain required until compatibility retirement is separately approved.

## AI-ready read profiles (proposal only)

All endpoints below inherit server UCellRequestContext, per-resource BOLA/RBAC, class projection, typed EvidenceResult, source watermark and strict schema validation from [AI-ready](AI_READY_FOUNDATION_SPEC.md). Clients/models cannot supply actor roles or grants. Standard errors: 400 INVALID_QUERY/AMBIGUOUS_SCOPE, 401 UNAUTHENTICATED, 403 DENIED without existence disclosure, 409 CONTEXT_CHANGED, 422 HISTORICAL_UNAVAILABLE/INCOMPATIBLE_GRAIN, 429 RATE_LIMITED, 503 SOURCE_UNAVAILABLE and 504 TIMEOUT. No current fallback or zero fill. Lists use snapshot-bound cursor, default50/max200; invalid/stale cursors require refresh. Monetary decimals are strings. Period/asOf modes are explicitly supported per service, never silently ignored.

| Proposed endpoint / gateway tool | Inputs / time | Authorization, evidence and limits |
|---|---|---|
| GET /v2/member/balls/:id/explain/active / getActiveStatus | Ball, period or supported asOf, knowledgeCutoff | Owned selected Ball; consumption/transition refs; MEMBER_SELF; one Ball |
| GET /v2/member/balls/:id/explain/performance / explainPerformance | Ball, period/asOf, cursor | Owned Ball; typed recognition/replay refs; MEMBER_SELF; page cap200 |
| GET /v2/member/balls/:id/explain/binary / explainBinaryCarry | Ball, tree, weekly period/asOf | Owned Ball and matched tree; finalized snapshot/revision; MEMBER_SELF |
| GET /v2/member/awards/:id/explain / explainAward | Award ID, revision/asOf | Award belongs to authorized Ball; stored theory/final/destination refs; MEMBER_SELF |
| GET /v2/member/settlements/:id/explain / explainSettlement | settlement ID, revision | Only own projected portion; settlement snapshot; MEMBER_SELF |
| GET /v2/member/payouts/:id/explain / explainPayout | payout ID, asOf if supported | Own payout; masked receipt/batch/recovery refs; MEMBER_SENSITIVE minimized |
| GET /v2/member/returns/:id/explain / explainReturnImpact | return ID, revision | Own order/return; POSTED/replay/recovery chain; MEMBER_SELF |
| GET /v2/member/balls/:id/explain/rank / explainRank | Ball, effective date | Own Ball; formally supported rank history only; MEMBER_SELF |
| GET /v2/admin/reservoirs/:kind/entries/:id/explain / explainReservoirB | A or B, entry ID, revision | Finance policy only; typed source and destination; FINANCE_CONFIDENTIAL; never Member |
| POST /v2/admin/analytics/query / queryMetric | Registered metrics/time/dimensions/filters/groupBy/comparison/cursor | Per metric/field role policy; preview for broad financial scope; max10 metrics/200 rows; no SQL |
| GET /v2/admin/binary-trees/:id/stats / getTreeStats | tree, anchor, time, metric, cursor | Authorized operational tree; ancestry/ownership/metric version; bounded server projection |
| POST /v2/knowledge/lookup / lookupKnowledge | topic/query, locale, effective date, cursor | Audience/classification checked; APPROVED effective document/version/unit refs; max20 units |

Admin equivalents of Member Explain reads use explicit admin resource grants and projected fields, never a bypass flag on Member endpoints. Current facts may use existing authoritative v1 adapters; asOf unsupported by an adapter fails closed. The internal gateway invokes these same services and is not a public generic execution endpoint. Tree settings and export commands retain normal authorization/idempotency/audit; AI tools cannot invoke writes. Proposed export jobs persist resolved query/version/snapshot and recheck access on download; 100k-row proposal cap, expiring download links and no raw financial export through the model. Tree detail/statistics declare current/period/asOf support separately; tree settings are current versioned configuration, historical settings read from effective configuration history.
