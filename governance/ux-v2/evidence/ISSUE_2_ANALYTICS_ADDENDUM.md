# Issue #2 fourth comment — retrieved 2026-09-18

Source: https://github.com/joewschang/UCell/issues/2#issuecomment-5721655484

## Product Owner / SA addendum — Management Analytics & BI Center

Add a formal Management Analytics / BI layer to Phase 1. This is an authoritative server-side analytics/read-model design, not frontend arithmetic and not a compensation-rule change.

Create a dedicated Phase-1 deliverable:
`governance/ux-v2/MANAGEMENT_ANALYTICS_AND_BI_SPEC.md`

### 1. Analytics Center information architecture
Admin > 分析中心 should organize analytics into domains rather than dozens of unrelated reports:
- Executive — 營運總覽
- Organization — 組織 / Multi-Tree / Founding Ball / Sponsor / Binary
- Performance — GPV / RPV / EPV / Product/Package
- Rank & Talent — 聘階 / 升階 / 人才梯隊
- Bonus — 獎金結構 / 分群 / 集中度 / K0/K1/K2
- Customer Quality — Active / Retention / Cohort / Return
- Finance & Governance — Settlement / Payout / Recovery / Reservoir A/B / Integrity

Use one authoritative filter context where applicable: period, BinaryTree, founding Ball/subtree, rank, Active status, product/package. Filters must be server-enforced and RBAC-aware.

### 2. Return-rate analytics
Design authoritative return analytics using POSTED Return as the economic return boundary. At minimum define:
- order return rate = qualifying orders with POSTED return / qualifying order population;
- amount return rate = POSTED returned recognized amount / corresponding recognized sales amount;
- unit/SKU return rate where quantity evidence exists;
- return rate by Product/SKU/Package;
- return rate by BinaryTree / founding Ball subtree;
- return rate by Qualification and Person only for authorized operational views;
- return reason distribution;
- return trend by month/settlement period;
- bonus impact from returns: affected GPV/EPV/Active/Awards, Recovery and Clawback totals/counts.

Every rate must document numerator, denominator, eligibility population, period semantics and zero-denominator behavior. Do not count REQUESTED/APPROVED/RECEIVED as official economic returns.

### 3. Rank analytics
Primary statistical grain is Qualification/Ball, not Person, because one Person may own multiple Balls.

Provide:
- current/historical rank distribution;
- total Balls by rank;
- Active Balls and Active rate by rank;
- GPV/performance and authoritative bonus totals by rank;
- rank movement/achievement events where supported;
- newly achieved rank by period;
- rank retention/maintenance where the applicable rule actually supports such semantics;
- rank-by-Tree and founding-subtree comparisons;
- next-rank pipeline using authoritative qualification/rank evidence only.

Do not invent downgrade semantics for cumulative/non-downgrading rank models. Clearly distinguish current display rank, achieved rank and any Global-specific cumulative rank evidence if they are different concepts.

### 4. Talent pipeline / next-rank analysis
Where authoritative rule evidence permits, expose candidates approaching the next rank with the exact approved requirement dimensions and remaining gap. This is descriptive operational assistance only; it does not award/promote a rank and must not calculate from undocumented frontend rules.

### 5. Bonus mix analytics
Analyze approved bonus types separately. At minimum support applicable categories such as Referral, Referral Matching, Binary, Binary Matching, RPV, EPV, Global and other formally modeled award types.

For each type distinguish lifecycle/economic fields where available:
- Theory
- Final/materialized
- Payable
- Paid
- Recovery/Clawback/Adjustment

Never collapse PENDING/null into a fabricated amount.

### 6. Bonus distribution cohorts
Provide configurable/default award-income bands for a selected authoritative period. Initial proposed UI bands may include:
- 0
- 1–5,000
- 5,001–20,000
- 20,001–50,000
- 50,001–100,000
- 100,001–300,000
- 300,001–1,000,000
- >1,000,000

The spec must decide whether the distribution grain is Qualification/Ball (default) and provide Person aggregation only as a separate explicit view. For each band show count/share, average, median where supported, GPV/performance, Active rate and rank mix. Bands must be configuration/read-model parameters, not hardcoded into Bonus Core.

### 7. Bonus concentration analytics
Design descriptive concentration metrics:
- Top 1% / 5% / 10% share of selected finalized/paid bonus basis;
- median;
- P75/P90/P95/P99;
- optional Lorenz/Gini only if implementation can define the population and monetary basis rigorously.

These metrics are analytics only and must never automatically cap or modify awards.

### 8. Active / retention analytics
Provide:
- total member Balls;
- Active / Inactive counts;
- Active rate;
- newly Active in period;
- prior-period Active retained into current period;
- consecutive Active-month cohorts (1/3/6/12 months where evidence supports it);
- Active by Tree/founding subtree/rank/product cohort.

If NASL is used, preserve its formally approved state definitions and effective-dated transitions. Do not infer Suspend/Lost merely from UI absence.

### 9. Acquisition cohort analytics
Group newly created/effective member Qualifications by acquisition month and track subsequent months where authoritative evidence exists:
- Active rate M0/M1/M2/M3/M6 etc.;
- performance/GPV;
- bonus basis;
- return rate;
- rank achievement rate;
- retention.

Qualification package idempotent retries must not create duplicate cohort members.

### 10. Sponsor productivity analytics
By Sponsor Qualification, where authorized:
- direct count;
- new directs in period;
- valid/effective direct count under applicable rules;
- direct Active rate;
- sponsored/downline performance using clearly defined Sponsor-tree scope;
- Referral and Referral Matching award metrics;
- distribution of Sponsors by 0/1/2/3/4+ directs or configurable bands.

Never substitute Binary descendants for Sponsor descendants.

### 11. Binary balance / Carry analytics
Across selected population provide:
- left-only Carry / right-only Carry / both / none counts;
- Carry volume bands;
- Carry aging based on authoritative carry/replay evidence where feasible;
- L/R performance balance;
- Pair PV trend;
- Tree/founding-Ball comparisons.

Any Balance Ratio/Carry Pressure score is descriptive analytics only and must not enter Bonus Engine.

### 12. K0/K1/K2 trend analytics
Provide time-series by authoritative settlement period for K0/K1/K2, pool basis/theory totals where authorized, and anomaly/threshold alerts as descriptive monitoring. Analytics may Observe/Alert but must never modify K values or rule parameters.

### 13. Product / Package analytics
Where authoritative data exists:
- units/orders/recognized sales;
- GPV/RPV/EPV attribution;
- purchaser Qualification count;
- repeat purchase rate;
- return rate;
- qualification-package purchases;
- new Ball creation success;
- payment success/failure where provider evidence exists;
- idempotent duplicate prevention evidence where useful operationally.
Inventory/PICK/SHIP remains deferred unless separately approved.

### 14. Multi-Tree comparison
Create a comparison read model/dashboard for Tree metrics, including where authoritative:
- member Ball count;
- monthly new Balls;
- Active rate;
- cumulative/month performance;
- return rate;
- finalized/paid average/median bonus basis;
- Carry/balance indicators;
- Reservoir B inflow;
- last settlement/update.
No cross-tree leakage.

### 15. Reservoir analytics
Reservoir A:
- period inflow;
- cumulative balance;
- proportion of the relevant approved Global pool basis where meaningful;
- source periods/evidence.

Reservoir B:
- period inflow;
- cumulative balance;
- by BinaryTree;
- by Company Ball #1/#2/#3;
- by award/entitlement type;
- replay delta/adjustment trend.

A and B remain separate ledgers/read models.

### 16. Recovery / Clawback analytics
Provide:
- period Recovery amount/count;
- Clawback amount/count;
- affected Qualifications;
- source Return/replay reason categories;
- product/package correlation where supported;
- Recovery relative to a rigorously defined paid-award denominator.
Original PAID evidence remains immutable.

### 17. Settlement quality dashboard
For each 10th/25th settlement batch and related weekly Binary closes, where evidence exists show:
- recognition event counts;
- award counts;
- K0/K1/K2;
- Payable/Paid basis;
- Reservoir A/B flows;
- Recovery/Replay counts;
- integrity alerts;
- settlement/replay duration and outbox backlog if authoritative operational telemetry is available.
Do not synthesize missing telemetry.

### 18. Statistical grain and historical semantics
Default monetary/organization grain = Qualification/Ball unless a report explicitly states Person aggregation.
Every metric must document:
- grain;
- numerator/denominator;
- source authoritative facts;
- event/effective timestamp used;
- timezone/period boundary;
- historical/as-of behavior;
- replay/return behavior;
- rounding;
- null/unavailable semantics.
Historical reports must not use current-state fallback.

### 19. Read-model architecture
Phase 1 must propose server-side read models/period aggregates for analytics. Do not recursively fetch full organizations into the browser.
Evaluate event-driven/materialized aggregates and rebuild/reconciliation strategy for at least:
- Tree/founding subtree aggregates;
- Return aggregates;
- Rank snapshots/events;
- Bonus distribution aggregates;
- Active/retention/cohort aggregates;
- Sponsor productivity;
- Carry/Pair aggregates;
- K trend;
- Reservoir/recovery aggregates.

Specify indexes, partition/period strategy if needed, incremental update, replay correction, rebuild from immutable facts, and expected scaling at 10K/100K/1M+ Qualifications.

### 20. Dashboard UX
Use summary cards + trend charts + comparison tables + drill-down, with progressive disclosure. Every chart/table must expose `資料期間`, `資料更新時間`, and authoritative source/evidence context where appropriate. Exported CSV must use the same filters and definitions as the on-screen query.

### 21. Alerts
Design deterministic alerts for material changes/anomalies such as return-rate spike, K deterioration, Carry concentration, Active-rate decline, unusual Recovery increase, settlement integrity failure. Alerts detect and explain; they do not mutate Core data or rules.

### 22. Required Phase-1 test/evidence plan
The spec must define future executable evidence for at least:
- return numerator/denominator and POSTED-only semantics;
- historical rank distribution/as-of correctness;
- multi-Ball Person does not distort Qualification-grain rank/bonus statistics;
- bonus bands/counts reconcile to authoritative finalized/paid population;
- concentration metrics use declared population/basis;
- Active cohort month boundaries Asia/Taipei;
- holder transfer does not create a new acquisition cohort member;
- Sponsor analytics never use Binary descendants;
- Carry statistics equal authoritative settlement/replay Carry;
- Return/replay updates affected aggregates deterministically;
- Tree isolation;
- Reservoir A/B isolation;
- CSV filter parity;
- RBAC/data masking;
- no frontend official monetary calculation;
- read models can rebuild/reconcile from immutable facts.

### 23. Phase-1 output update
Add `MANAGEMENT_ANALYTICS_AND_BI_SPEC.md` to the mandatory Architecture Review package and update `INFORMATION_ARCHITECTURE.md`, `PAGE_MAPPING.md`, `API_V2_PROPOSAL.md`, `MIGRATION_43_PLUS_PROPOSAL.md`, and `ARCHITECTURE_GAP_ANALYSIS.md` for Analytics Center impacts.

Still STOP after Phase 1. No Migration 43+, no Core routing implementation, no mass UI rewrite, no Stage redeployment, no Production promotion until Product Owner/SA Architecture Review.
