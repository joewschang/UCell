# AI Core — Member Service and Admin Copilot

Status: PROPOSED, Phase 1 architecture only. Authority: Issue #2 comments 5721760042 and 5721811201, reproduced in [AI addenda](evidence/ISSUE_2_AI_ADDENDA.md). No provider, model, vector database, ingestion, executable gateway, AI tables or UI is implemented. Core remains the only monetary authority; Production BLOCKED.

## Boundary and flow

Member/Admin UI → provider-independent orchestrator → UCell allowlisted Tool Gateway → server authorization, policy and audit → authoritative Core/Analytics read services or approved knowledge retrieval. The provider adapter exchanges typed messages and tool requests, never database credentials, SQL or internal service tokens. OpenAI, Azure or private/sovereign hosting can be substituted without changing tool/domain contracts. Provider choice, residency and procurement follow separate review.

The model explains returned facts; it cannot compute official eligibility, GPV/RPV/EPV, Carry, PairPV, K0/K1/K2, awards, settlement, payout, recovery or A/B balances. Deterministic backend aggregation may derive a registered metric with provenance. Narrative arithmetic must not replace that metric. Charts bind exact returned decimal values and unit/rounding metadata, not numbers extracted from model prose.

## Member service

Home has an AI help card; Active, Performance, Binary, Award, Payout and Return pages have contextual「為什麼」actions. Selected Ball and period stay visible. One owned Ball is mandatory for Ball facts; no silent switching or merging. Portfolio uses a separately authorized Person aggregate and identifies each included Ball. Missing/ambiguous selection prompts selection without querying other Balls. Server resolves ownership on each tool call, including historical access under the approved access policy; historical ownership alone does not grant current access.

Supported intents: navigate; explain Active and consumption; GPV/RPV/EPV; Binary Pair/Carry; Award; settlement vs payout; own orders/returns/recovery; portfolio; approved制度/product/support knowledge. Company nodes may be labeled 公司球 where the normal viewer permits them. Company income, Reservoir B and admin controls are unavailable to Member AI. The AI cannot turn an ordinary upstream tree node into permission to read that person's details.

## Admin Copilot

Persistent entry within Admin and Analytics Center, with actor role, tree, period/asOf, metric version and Company included/excluded chips. Broad financial requests first show a deterministic query-plan preview: metric, grain, filters, time basis, finalized vs paid, comparison, company separation and estimated scope. Ambiguous financial terms require clarification; preview confirmation authorizes only that read scope. Narrow existing contextual reads need no extra confirmation.

Metrics come from the shared catalog in [AI-ready foundation](AI_READY_FOUNDATION_SPEC.md) and [BI specification](MANAGEMENT_ANALYTICS_AND_BI_SPEC.md). Alerts are deterministic registered thresholds with evidence. Model commentary is labeled a recommendation, with uncertainty and supporting facts. No mutation of rank, placement, ownership, award, settlement, payout, return, settings or lifecycle. MVP 1 reads/explains; MVP 2 detects/recommends; possible MVP 3 creates a draft followed by human confirmation and normal RBAC commands. MVP 3 is outside the approved implementation scope and never grants the model credentials to execute commands.

## Knowledge and answer contract

Structured answers and knowledge answers are visibly distinct. Structured facts cite evidence IDs, authoritative timestamp, selected scope and canonical deep link. Knowledge cites title, version, effective date, section and approved source. Current-rule lookup includes only APPROVED and currently effective versions; historical lookup requires an explicit historical date and matching version. Conflicting authority returns a conflict state for governance review; it does not blend competing rules. User-uploaded or retrieved instructions cannot alter system policy or grant tools.

| State | UI / tool handling |
|---|---|
| AUTHORITATIVE | Show exact typed fact, evidence and finality |
| KNOWLEDGE | Show approved citation; do not imply personal eligibility |
| PARTIAL | Identify missing components; never fill totals with zero |
| UNAVAILABLE / HISTORICAL_UNAVAILABLE | 「目前無法取得可驗證資料」; link to authoritative page if authorized |
| DENIED | Generic denial; no existence or cross-person metadata disclosure |
| AMBIGUOUS | Ask for Ball, metric or period; no speculative tool call |
| STALE | Show source timestamp and lag; prohibit definitive current monetary claim |
| TIMEOUT | Retry bounded read or navigate; no invented fallback |

## Gateway security and audit

Only registered tool names and strict schemas are accepted. Reject unknown fields, arbitrary URLs, SQL, expressions, noncatalog metrics and unbounded traversal. Model-supplied actor/roles/permissions are rejected. Tool execution uses server UCellRequestContext; every resource, filter, evidence reference and deep link is independently authorized. Validate provider output and escape displayed content. Treat retrieval, tool text and user prompts as untrusted data; instructions embedded in them cannot change tool policy. Rate limit by actor/role; cancel on context switch and suppress stale responses.

Field projection occurs before model exposure and before telemetry. Never send passwords, credentials, tokens or secrets; omit bank/payment identifiers, contacts and application narratives unless a specifically approved minimal projection is essential. Masking must happen server-side, not through an instruction to the LLM. Financial access inherits endpoint RBAC and row/field restrictions, with no role union through chat history.

Proposed audit metadata: interactionId, actorId/type, role snapshot, authorized scope IDs, tool name/version, redacted argument summary/hash, metric/knowledge versions, evidence references, provider/model version when later connected, correlationId, outcome/denial code, duration and recordedAt. Authorization/evidence trace belongs in controlled durable audit; transient token usage/latency belongs in operational telemetry. Raw prompts/responses are OFF by default. Proposed operational retention 30 days; trace retention 180 days subject to governance approval and financial evidence retention requirements. Existing financial evidence retains its own mandated lifecycle. Redact before persistence, restrict audit readers, record approved overrides/legal holds, and test expiry. These durations are review proposals, not deployed policy.

## Acceptance plan (not executed AI tests)

1. Owned Ball read succeeds and cites evidence; 2. another Person's Ball is denied; 3. same Person's nonselected Ball cannot silently merge; 4. cross-tree request denied; 5. Admin role/field restrictions enforced; 6. Member Reservoir B denied; 7. missing monetary source fails closed; 8. finalized and paid remain distinct; 9. historical query never uses current fallback; 10. superseded knowledge excluded; 11. prompt injection cannot widen tools; 12. arbitrary SQL/URL rejected; 13. PII/secrets absent from provider and logs; 14. stale/timeout/partial responses labeled; 15. chart values match API decimals; 16. audit trace joins evidence and correlation without raw secrets; 17. context switch cancels stale response; 18. provider adapters pass the same deterministic tool contract fixtures. Actual LLM factual, injection and latency/cost evaluation waits for separate provider authorization.

See [API contracts](API_V2_PROPOSAL.md), [migration proposal](MIGRATION_43_PLUS_PROPOSAL.md), and [review report](PHASE1_ARCHITECTURE_REVIEW_REPORT.md).
