# Current page -> Experience v2 mapping

Phase 1 route-preservation contract. Source-of-truth route declarations: `member/src/App.tsx` and `admin/src/app/App.tsx`; Admin menu: `admin/src/app/nav.ts`. Existing non-route dialogs/forms are mapped below as capabilities, not invented routes. Target URLs are proposals. No existing route is removed in this phase.

## 1. Member routes (all current declared routes)

| Current route / component | v2 destination | Preserve / dependency / compatibility |
|---|---|---|
| `/` Home | `/` 首頁 | current Ball, Active/repurchase, bonus, performance and quick links; new authoritative progress/payout read model needed |
| `/organization` Organization | `/organization/sponsor` and `/organization/binary` | redirect to explicit tab/default Sponsor; preserve separate queries and referral share; Binary gets bounded viewer |
| `/performance` Performance | `/earnings/performance` | preserve month; `pv` must be source-audited before GPV display; no client calculations |
| `/bonuses` Bonuses | `/earnings/awards` | lifecycle, final/theory/payable, payout dates, ledger/recovery detail; preserve month and award deep link |
| `/shop` Shop | `/shop` | ordinary product/order flow and qualification/other package selection; zero-Ball branch retained |
| `/orders` Orders | `/shop/orders` | refresh, expansion, connected order/payment/delivery details; preserve selected Ball/order |
| `/content` ContentList | `/me/content` | existing content authorization and listing |
| `/content/:id` ContentDetail | `/me/content/:id` | preserve exact content ID and Ball context; deleted/unavailable content state |
| `/me` Me | `/me` | Person profile, registration/formal upgrade, portfolio, session controls |
| `/notifications` Notifications | `/me/notifications` | selected Ball scope and persisted read evidence; do not invent LINE read state |
| `*` fallback | not-found + home/account links | no implicit unauthorized Ball fallback; zero-Ball prerequisite branch remains |

New Member `/earnings`, payout/ledger subviews and organization viewer are additions, not replacement of source evidence. Existing Bonus ledger can initially be linked into its new subview without changing calculations. Preserve query parameters during redirect, validate IDs server-side, avoid redirect loops and duplicate browser-history entries.

## 2. Member embedded capabilities

| Source component | New home / retained behavior |
|---|---|
| QualificationContext / ContextBar | global shell context; confirmed selection and stale-request protections |
| ProfileEditor | 我的 > profile/contact editing; preserve server validation |
| NetworkRegistration | 我的 > membership; network registration/OTP/consent prerequisites unchanged |
| FormalUpgrade | 我的 > formal application; do not imply KYC alone creates Ball |
| QualificationPackageShop | 商城 > qualification packages; Ball creation/setup effects explicitly described |
| ActiveDurationPackages | 商城 > existing configured package offering; preserve approved effect/configuration, do not invent an Active exception |
| RepurchaseDetails | 首頁 Active/repurchase detail and 商城 subscription detail, distinct from financial Active |
| ReferralShare | 組織 > Sponsor; attribution/prefill distinct from final Sponsor confirmation |
| ConnectedShop / ConnectedOrderDetails | 商城 and order detail, idempotent commands and authoritative totals |
| NotificationContext | shell notification state; mock mode remains clearly labelled |
| EndSession / SessionBoundary / AppErrorBoundary | shared session/error behavior across all routes |

## 3. Admin routes (all current declared routes)

| Current route / source page | v2 destination | Existing capability retained |
|---|---|---|
| `/login` LoginPage | `/login` | actual Admin authentication; no new bypass |
| `/` DashboardPage | `/` 營運中心 | operational summary/timezone/current status and explicit unavailable metrics |
| `/people` PeoplePage | `/members/people` + `/members/people/:id` | search/create Person, detail drawer, paginated owned Qualifications, Ball detail |
| `/applications` ApplicationsPage | `/members/applications` | application listing/review and evidence |
| `/applications/new` NewApplicationWizard | `/members/applications/new` | all creation steps, Sponsor/Binary distinction and existing validations |
| `/qualifications` QualificationsPage | `/members/balls` + `/members/balls/:id` | search and QualificationDetail, status/history, all current tabs |
| `/products` ProductsPage | `/commerce/products` | product reference/rule-profile administration |
| `/packages` PackagesPage | `/commerce/packages` | draft/version/configuration, selections, approve/schedule/retire; separate manage/approve roles |
| `/orders` OrdersPage | `/commerce/orders` | source order/payment/invoice/fulfillment details and permitted provider operations; keep route-dependent scopes |
| `/organization` OrganizationPage | `/organization/sponsor` or `/organization/binary` | root/depth/as-of query and separate viewers; compatibility preserves chosen mode |
| `/subscriptions` SubscriptionsPage | `/commerce/subscriptions` | subscription recognition/cancellation/evidence; no new RPV calculation |
| `/bonuses` BonusesPage | `/finance/settlements` | all existing calculation/settlement evidence/actions within current authority, cockpit overview added |
| `/returns` ReturnsPage | `/commerce/returns` | approved Return/Replay/recovery actions and history; finance links to same resource |
| `/workflows` WorkflowsPage | `/members/workflows` | upgrade/transfer/exit/retransfer submission/approval and evidence, with current policy guards |
| `/payouts` PayoutsPage | `/finance/payouts` | batch review/approvals/recovery/reconciliation/export/paid evidence; no weakening dual review |
| `/content` ContentPage | `/commerce/content` | versioned content management and visibility |
| `/documents` DocumentsPage | `/governance/documents` | attachments/evidence and permissions |
| `/audit` AuditPage | `/governance/audit` | audited queries and evidence inspection |
| `/reports` ReportsPage | `/governance/integrity` | current reporting/integrity checks; does not imply new Tree Analytics exists |
| `/uat` UatPage | `/release/uat` | current UAT scenarios/actions/evidence classification retained |
| `/system` SystemPage | `/release/readiness` | system readiness/configuration/security/operations evidence and blockers |
| `*` fallback | not-found + authorized home | no redirect to unauthorized object/role |

## 4. Admin embedded and new workspaces

QualificationDetail current tabs Overview/Sponsor/Binary/Active/PV-RPV-EPV/Orders/Bonus/Ledger/Settlement/Audit become Ball 360 Overview/Sponsor/Binary/Performance/Bonus/Orders/Returns/Ledger/Audit, with Active section in Overview and dedicated detail, Settlement source retained under Bonus/Ledger links. No loss of settlement evidence or existing history truncation disclosure. PeoplePage's embedded Person detail is upgraded in place; there is no assumed existing `PersonDetail.tsx` module.

| Added page | Proposed route | Required authoritative dependency / gate |
|---|---|---|
| Tree List | `/organization/trees` | tree registry/list API; no synthesized fake trees |
| Tree Detail | `/organization/trees/:treeId` | scope-aware stats, bootstrap and lifecycle |
| Tree Settings | `/organization/trees/:treeId/settings` | create/rename/transition command receipts; no delete |
| Bootstrap Viewer | tree detail section | actual canonical positions/occupancy; #1..3 locked |
| Founding Statistics | `/organization/trees/:treeId/founding` | temporal ancestor/period projection and settlement Carry |
| Founding drill-down | Ball 360 + `treeId/root/month/asOf/context` | cross-tree check and exact descendant definition |
| Placement Console | `/organization/placements` | preflight/command, existing setup queue/72h SLA and Sponsor evidence; D2 for founding |
| Tree Analytics | `/organization/analytics` | descriptive server projection; unavailable retention/NASL |
| Reservoir Center A/B | `/finance/reservoirs/A` and `/finance/reservoirs/B` | A existing facts; B proposed typed effects; no outflow |
| Reconciliation | `/finance/reconciliation` | source-specific authoritative totals and evidence |
| Person 360 | `/members/people/:id` | identity + authorized paginated portfolio/links |
| Ball 360 | `/members/balls/:id` | explicit owner/tree/context/evidence, Company rendering branch |
| Explain drawer | parent route modal/state | same context and resource permission; no new unrestricted generic URL |
| Release Control Tower | `/release/readiness` | combined existing UAT/system evidence, retains separate subroutes |

## 5. Preservation and release acceptance

For each mapping assert: old route still resolves or redirects; current page capability reachable; query/object/period context retained; correct role guards; refresh/back/forward works; no-Ball branch preserved; server errors propagate; no money recalculation. Compare route inventory programmatically to these tables before a future navigation merge. New commands require API/DB acceptance, not only screenshot success.

UI rewriting, schema migration, Stage redeployment and Production promotion are outside this docs phase. The mapping is READY_FOR_IMPLEMENTATION as a design contract; new-domain controls remain gated by companion specs and PO decisions.

## New upstream and AI mapping delta

Existing Admin /analytics and its v1 /admin/analytics reads are retained and mapped into 分析中心; overview/NASL/transitions/cohorts/history/sonar/volumes remain accessible under current RBAC. Broad BI tabs extend that workspace as proposals. Member Home AI card, contextual Active/Performance/Binary/Award/Payout/Return Why drawers and persistent Admin Copilot are NEW PROPOSED entries, with no existing functionality removed. Canonical links in AI-ready are logical aliases pending router mapping; do not deploy redirects until ID, role, scope and history context preservation tests pass. No AI routes/providers have been added in Phase 1.

Final source delta 935e8a2: existing Admin /provider-operations (Provider Webhook 營運) remains under 系統治理, preserving safe health/backlog filtering, refresh, role gating and server fields. This is an upstream existing route, not an AI feature or a change in this package.
