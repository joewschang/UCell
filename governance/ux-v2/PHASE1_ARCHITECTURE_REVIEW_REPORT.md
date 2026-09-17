# Phase 1 Architecture Review Report

Review continuation: [D1/D2 decision worksheet](ARCHITECTURE_DECISION_WORKSHEET.md) provides a concrete PO/SA decision form. Both decisions remain pending; the continuation is architecture review only.

Disposition: READY FOR ARCHITECTURE REVIEW; NOT implementation approval. Production promotion BLOCKED. Final source baseline: `935e8a288f0e0891e657175a0f9a4f1afc12a47b`, branch `integration/member-backend-mvp`. Only this governance package is changed. No Core/UI/schema/migration/provider/Stage/Production implementation is included.

## Deliverables and review coverage

| Deliverable | Review purpose |
|---|---|
| [UX_AUDIT](UX_AUDIT.md) | Existing functional inventory, task friction, source gaps and no-loss modernization |
| [INFORMATION_ARCHITECTURE](INFORMATION_ARCHITECTURE.md) | Member five destinations, Admin domains, Ball/tree context, Analytics/AI entry points |
| [COMPONENT_SPEC](COMPONENT_SPEC.md) | Components, authorization/error/empty states, keyboard/accessibility and evidence |
| [PAGE_MAPPING](PAGE_MAPPING.md) | Existing routes to proposed tasks, preserved capabilities and aliases |
| [TERMINOLOGY_AUDIT](TERMINOLOGY_AUDIT.md) | GPV/RPV/EPV, Active, payout calendar and semantic conflict handling |
| [MULTI_TREE_COMPANY_BALL_SPEC](MULTI_TREE_COMPANY_BALL_SPEC.md) | Atomic bootstrap, company ownership/Active, Sponsor, post-calculation B routing |
| [BINARY_TREE_ADMIN_AND_STATISTICS_SPEC](BINARY_TREE_ADMIN_AND_STATISTICS_SPEC.md) | Lifecycle/placement, founding anchors, historical statistics and scale |
| [ARCHITECTURE_GAP_ANALYSIS](ARCHITECTURE_GAP_ANALYSIS.md) | Requirement/source/gap matrix and current baseline reconciliation |
| [MIGRATION_43_PLUS_PROPOSAL](MIGRATION_43_PLUS_PROPOSAL.md) | Logical schema, temporal evidence, exactly-once destination and backfill gates |
| [API_V2_PROPOSAL](API_V2_PROPOSAL.md) | Proposed command/read/Explain/query contracts and RBAC/time/error profiles |
| [PENDING_ARCHITECTURE_DECISIONS](PENDING_ARCHITECTURE_DECISIONS.md) | D1/D2 product decisions; separate engineering/provenance gates |
| [MANAGEMENT_ANALYTICS_AND_BI_SPEC](MANAGEMENT_ANALYTICS_AND_BI_SPEC.md) | Cohorts, returns, rank/distributions, volumes, Carry, K and A/B |
| [AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC](AI_CORE_MEMBER_SERVICE_AND_ADMIN_COPILOT_SPEC.md) | Read-only assistance, authority, UX, masking and minimal audit |
| [AI_READY_FOUNDATION_SPEC](AI_READY_FOUNDATION_SPEC.md) | Shared catalogs, Explain, historical readiness, knowledge, context and simulator |
| [VERIFICATION](VERIFICATION.md) | Executed tests separated from future acceptance criteria |

Authority boundary: Issue #2 body and six captured addenda, repository SSOT/frozen documents, SA decisions v3 and Boundary/Volume/Core addenda. [Snapshot](evidence/ISSUE_2_SNAPSHOT.md) links the BI and AI addenda. Filed originals were not independently authenticated outside the supplied repository; governance sign-off must confirm higher-authority versions. No unresolved product decision is silently defaulted to an implementation.

## Architectural conclusions

Person and Qualification remain separate. Each new tree atomically creates real company Balls #1/#2/#3; #4–#7 are available canonical positions until actual member placement. Founding Company Sponsor evidence is separate from Binary parent. Explicit effective company ownership controls Always Active and B routing; member NT$2,000 semantics remain intact. Company entitlements take the authoritative normal Core path, preserving K/pool/theory, then route exactly once to B with no member payout. A/B remain separate accrual ledgers; signed corrections do not authorize withdrawals. Tree archive does not erase topology, evidence or later economic corrections.

Authoritative adjacency and temporal evidence support bounded server projections, not browser-wide recursion or an unbounded quadratic closure requirement. Statistics declare Ball/Person grain, anchor inclusion, company separation, time and denominator. Historical reads never substitute current topology/rank/ownership. Existing management NASL/history at 924dadc is reusable partial infrastructure, not full requested multi-tree financial history.

D1: company bootstrap plan/rank/eligibility needs approved configuration. D2: explicit Company Sponsor designation and compatibility with first/third-left rule need a bounded decision; do not disable ordinary member guardrails. Remaining backfill, provenance, load/performance and authorization tests are engineering gates. Existing worker consumption threshold/source conflict is recorded for a separately authorized implementation correction, not changed by Phase 1.

## AI-ready review: explicit answers

| Question | Architecture answer / implementation limitation |
|---|---|
| Can AI explain an Award without recalculating it? | Yes by design: ExplainAward returns stored theory, K/cap/final/destination evidence. Unified contract/gateway is proposed, not implemented. |
| Can it answer historical questions without current-state fallback? | Only where evidence supports the requested date. Unsupported dates return HISTORICAL_UNAVAILABLE; temporal gaps are identified per Explain contract. |
| Can every metric trace to one declared definition? | Required by versioned MetricDefinition registry. Registration schema/key inventory exists in this proposal; full runtime definitions/validation remain implementation work. |
| Can Member AI be cryptographically/server-authoritatively restricted to owned Balls? | Yes by design: validated authentication plus server ownership/role checks per tool/resource, not model-supplied scope or token claims alone. Adversarial gateway tests remain required. |
| Can Admin AI respect RBAC and field masking? | Yes by design: service authorization and projection before provider/log exposure. No generic SQL or role bypass. Runtime integration is not present. |
| Can current-rule RAG exclude superseded rules? | Yes by metadata/effectivity/approval/authority filtering; conflicts fail closed. No ingestion/retrieval system has been deployed. |
| Can providers change without Core/tool semantic changes? | Yes: adapter outside UCell-owned tool/envelope contracts; no provider arithmetic or provider-specific domain schema. No provider chosen/connected. |
| Can AI layer be tested before connecting an LLM? | Yes: deterministic simulator plan and 24 curated seed cases are supplied. Simulator execution is later work; the target 120-case corpus is not claimed complete. |

## Implementation sequence after approval

1. Resolve D1/D2 and validate source/backfill authority.
2. Version semantic/metric catalog and evidence/Explain contracts.
3. Implement server context, classification and historical read readiness with isolation tests.
4. Establish canonical deep links and allowlisted Analytics query contract.
5. Establish approved knowledge metadata/units and retention controls.
6. Build provider-free simulator and expand/evaluate golden questions.
7. Implement reviewed multi-tree/company/B/schema/read-model/UI changes under separate authorization; execute MT/ST/economic replay/performance/security acceptance matrices.
8. Only after those gates, separately select/connect provider and RAG. Stage and Production promotion require their own release approval.

No item in this sequence is authorization to proceed now. Phase 1 ends at architecture review.

## Evidence and limits

Current baseline inventory: 995 source/document files hashed, 52 existing migrations, 151 OpenAPI operations, 687 terminology hits. Initial 903b8e9 manifest retained for comparison. Automated inventory is not a claim of line-by-line expert review of every file. Focused source findings are documented in the gap matrix.

At 924dadc: backend build PASS; API 60 suites / 571 tests PASS; Admin 21 files / 61 tests PASS; TODO/OpenAPI/security preflights PASS; Prisma validation PASS after supplying the local test DATABASE_URL (initial missing-env failure retained). Member 142 tests, Shared 19 and mandatory v3 17/17 passed at 903b8e9; Member/shared sources are unchanged between baselines, and full current API also covers the existing boundary/replay suites. These are regression checks of existing behavior, not proof of proposed AI/multi-tree functionality. See [verification](VERIFICATION.md) for database provenance and initial failures.

This package is reviewable with explicit gaps and gates; it does not claim D1/D2 approval, complete implemented architecture, fresh migration deployment, provider safety evaluation or Production readiness.

Final remote reconciliation: upstream 935e8a2 adds Admin /provider-operations under system governance. It is retained, not authored here. Final Admin retry passes 22 files / 63 tests. The first run failed the new provider page assertion while still loading; its fixed 20ms wait is timing-sensitive. Both logs are retained; the repeat pass does not prove the flake fixed. Backend/member/shared were unchanged by this upstream commit. This known test limitation does not authorize a UI/test code change in docs-only Phase 1.
