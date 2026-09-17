# Experience v2 information architecture

Status: Phase 1 specification; navigation URLs below are proposed product routes, not new deployed APIs. Preserve all current capabilities listed in [PAGE_MAPPING](PAGE_MAPPING.md). Role -> Task -> Decision -> Action -> Evidence is the organizing rule.

## 1. Member hierarchy

| Primary navigation (fixed order) | Secondary destinations | Primary context |
|---|---|---|
| 首頁 `/` | 今日任務, Active, 下一筆入帳, performance/weekly summary | current Ball; no-Ball onboarding branch |
| 組織 `/organization` | `/organization/sponsor`, `/organization/binary`, dedicated viewer, referral share, existing placement tasks | current Ball, independent tree mode, BinaryTreeId when relevant |
| 收益 `/earnings` | `/earnings/performance`, `/earnings/awards`, `/earnings/payouts`, `/earnings/ledger` | current Ball + authoritative period |
| 商城 `/shop` | ordinary products, qualification packages, other approved packages, `/shop/orders`, order/payment/delivery details, repurchase | current Ball for ordinary commerce; explicit acquisition context for new Ball |
| 我的 `/me` | Person profile, membership/application/consent, Ball portfolio, `/me/notifications`, `/me/content`, content detail, settings/session | Person; Ball-scoped child data labelled separately |

Global Ball Context remains visible above every Ball page. Switching changes Dashboard, Organization, Performance, Bonus, Orders and Active together. URL/context token stores the selected Ball as navigational intent only; server ownership remains authoritative. Person page does not silently change identity when Ball changes. Member Tree viewer uses Ball membership to resolve the tree and cannot browse admin tree lists or B.

No-Ball state: `/me` retains profile, network/formal registration and consent; `/shop` retains qualification-package acquisition. Other Ball-dependent destinations explain the prerequisite and link to existing acquisition. Pending-placement Balls show setup/placement status independently of financial Active; no label `ACTIVE` is inferred merely from paid package or FORMAL_MEMBER status.

Legacy `/performance`, `/bonuses`, `/orders`, `/content`, `/content/:id`, `/notifications` redirect to their mapped destinations with existing IDs/period/filter context preserved; use replace navigation to avoid back-button loops. `/organization` defaults to Sponsor or the user's explicit requested tab, never maps Sponsor evidence into Binary.

## 2. Admin hierarchy

| Domain | Workspaces / target paths | Role-driven purpose |
|---|---|---|
| 營運中心 `/` | tasks/alerts, operational counts, links to approval and replay queues | daily operator triage, explicit freshness and unavailable sources |
| 會員與資格 `/members` | `/members/people`, Person 360, `/members/applications`, application wizard, `/members/balls`, Ball 360, `/members/workflows` | Person/Qualification lifecycle, authorized identity, upgrades/transfers/exit |
| 商務 `/commerce` | products, packages, orders/payment/invoice/fulfillment, subscriptions, returns, content | preserve order/provider/detail capabilities; no new inventory accounting policy |
| 組織 `/organization` | `/organization/sponsor`, `/organization/binary`, `/organization/trees`, tree detail/settings/bootstrap/founding stats, `/organization/placements`, `/organization/analytics` | independent relationship evidence and governed placement |
| 獎金財務 `/finance` | `/finance/settlements`, `/finance/payouts`, `/finance/reservoirs/A`, `/finance/reservoirs/B`, `/finance/reconciliation` | settlement, payouts and source-specific financial governance |
| 治理稽核 `/governance` | audit events, documents/attachments, integrity reports, reviewed evidence links | traceability and read-only inspection |
| 系統與發布 `/release` | readiness tower, UAT, identity/security/operations evidence, existing system settings | environment-aware gates; Production BLOCKED |

Reservoir Center is anchored in 獎金財務 and cross-linked from 治理稽核 under 財務/治理. There is one canonical route per A/B ledger, not duplicate balances. Tree pages show only permitted financial subsections. Role-filtered navigation improves discoverability; server role/capability checks remain mandatory on direct URLs.

Person 360 deep link uses Person ID; Ball 360 uses Qualification ID. Tree/founding links carry treeId, QualificationId, month/asOf/knowledgeCutoff/settlement/contextToken. Returning to a table restores filters and cursor only if the pinned snapshot is still valid. Stale cursor prompts refresh; it does not silently combine old/new rows.

## 3. Context architecture

| Context | Owner / persistence | Invalidations / evidence |
|---|---|---|
| Session and role grants | existing authentication provider; never user-editable URL authority | expiry/logout/grant change clears scoped caches and private export links |
| Person | identity root | ownership portfolio authorization reevaluated after transfer; no old-holder future income |
| Ball | server-confirmed Qualification context | request cancellation + selection generation guard; clear all Ball-specific state on switch |
| BinaryTree | explicit membership evidence for Ball or Admin selection | mismatch blocks; cannot infer from Sponsor or currently open tab |
| Period | UI filter plus server-returned authoritative period/cutoff | month != weekly Binary != 10/25 batch; label all scopes |
| As-of / known-at | advanced audit filter with source availability | effective and recorded-time semantics in statistics spec; no current fallback |
| Projection generation | server context token | all panel data must share version or be individually labelled stale/unavailable |

URL serialization uses stable IDs and validated dates, never PII or raw credentials. Session memory may restore an authorized Ball, but a saved ID not in the returned portfolio is discarded. Cache keys include session/actor/role, Ball, tree, period and historical/projection context. Explain drawers inherit the exact parent context. Orders/checkout retain explicit target Ball in their command review; changing context during an in-flight command must not redirect its result to another Ball.

## 4. Cross-workspace paths

Person -> Ball portfolio -> Ball 360; Ball -> Sponsor viewer or Binary tree viewer with distinct relationship labels; founding statistics -> Ball 360 scoped to that subtree; Company Ball -> B effects -> Explain -> source settlement; settlement -> Return/Replay -> original Award/PAID + adjustments; integrity alert -> evidence, never auto-fix; Release blocker -> existing readiness/UAT evidence.

Breadcrumb examples: 組織 / 二元樹管理 / T001 / #4 創始位置; 獎金財務 / Reservoir B / calculation source; 會員與資格 / Person / Ball. TreeName is secondary to stable TreeCode. #4 is position within T001, not global Qualification #4.

## 5. Navigation verification

Every old route and capability must appear in PAGE_MAPPING; redirects preserve identifiers/query context and have no loops. Test authorized direct URLs and unauthorized bookmarked URLs, refresh/back/forward, no-Ball flow, multiple-Ball switch in every section, mobile bottom-nav selected state, keyboard focus, archive deep links, expiry and permission changes. DRAFT/CLOSED/ARCHIVED controls are visibly constrained and backend rejects bypass. A hidden menu is never counted as security proof.

The hierarchy and compatibility plan are READY_FOR_IMPLEMENTATION after review. New tree/B/360 read dependencies must land before those pages show AVAILABLE data. No implementation is initiated by this document.

## Analytics and AI additions

Admin 分析中心 retains the existing /analytics entry and opens BI overview, people/NASL, organization/founding, volumes/Carry, awards/distribution, returns and A/B tabs with role-aware scope chips. It complements organization operations rather than duplicating placement commands. Persistent Admin Copilot uses the same selected query context. Member Home AI card and contextual Why actions keep the existing five primary destinations; AI is assistance within the task, not a competing navigation hierarchy. Canonical entity aliases are governed by [AI-ready](AI_READY_FOUNDATION_SPEC.md); all route strings here are proposed until mapped and implemented.
