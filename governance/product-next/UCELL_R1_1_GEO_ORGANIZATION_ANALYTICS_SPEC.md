# UCell R1.1 — Geo Organization Analytics

Status: PROPOSED IMPLEMENTATION SPEC
Date: 2026-10-01
Baseline: R1.0B FROZEN
Rule impact: NONE (analytics/read-model only)

## 1. Governing rule sources

This feature MUST preserve R1.0B economic semantics and MUST NOT alter compensation outcomes.

Authoritative references:
- `backend/docs/R1_0B_FROZEN_SSOT.md`
- `governance/sa-decisions/R1_0B_VOLUME_CLASS_CLARIFICATION_20260917.md`
- `backend/apps/api/src/modules/bonus/binary-bonus.service.ts`
- `backend/apps/api/src/modules/binary-tree/binary-tree-metrics.ts`
- `governance/ux-v2/BINARY_TREE_ADMIN_AND_STATISTICS_SPEC.md`

### 1.1 GPV, not BV

R1.0B defines GPV as the concrete general-performance volume used by Binary and other applicable general compensation rules. Abstract BV has no active R1.0B bonus formula.

Therefore every L/R performance, subtree performance and geo-performance field in this feature SHALL use GPV semantics and GPV units. No new BV recognition, BV propagation or BV-derived monetary/analytics basis may be introduced.

Canonical labels:
- Left GPV / 左區 GPV
- Right GPV / 右區 GPV
- Monthly GPV / 月 GPV
- Cumulative GPV / 累積 GPV
- Pair PV / pairedPv only when reading authoritative finalized Binary settlement evidence

Do not label GPV as BV in UI, API, export, schema comments or documentation.

## 2. Product goal

For a selected root Ball/Qualification, show the geographic distribution of the complete Binary descendant subtree using the communication address of each descendant Ball holder.

The dashboard SHALL combine:
1. Tree View — organizational structure
2. Geo View — where the descendant market is located
3. Time View — how the market distribution changes over time

The dashboard is an analytics/read-model feature, not a compensation engine.

## 3. Metric definitions

### 3.1 Population
Default scope excludes root self and includes all Binary descendants effective at `asOf`.

- `descendantBalls`: distinct descendant Ball/Qualification count
- `uniqueMembers`: distinct Person/Member holders among descendant Balls
- `activeBalls`: descendant MEMBER Balls proven Active at checkpoint
- `activeRate`: activeBalls / eligible descendant MEMBER Ball population
- `newBalls`: first effective placements within selected period
- `gpv`: distinct signed GPV source facts attributable to descendants, including approved corrections exactly once

One Person owning multiple Balls contributes once to `uniqueMembers` and once per Ball to Ball-grain counts.

### 3.2 LEFT / RIGHT partition
LEFT/RIGHT is determined by the historical first Binary edge under the selected root, never by Sponsor relationship and never by current address.

- `leftBalls + rightBalls = descendantBalls`
- `leftGpv/rightGpv` use the same first-side partition as authoritative Binary tree metrics.
- Transfers/exits do not create a new Ball placement.
- Root self has no firstSide and is excluded by default.

### 3.3 GPV aggregation
Geo analytics MUST use distinct source GPV events and approved reversal/replay deltas. Never sum propagated ancestor ledger rows as if they were independent sales.

For historical views, source-time/effective-time/knowledge-cutoff semantics SHALL match the existing Binary statistics/read-model rules.

### 3.4 Carry and Pair
Carry and Pair are not recomputed by Geo Analytics.

- Left Carry / Right Carry: read the latest applicable finalized Binary settlement/replay evidence.
- Pair PV: read authoritative weekly `pairedPv` from finalized/replayed Binary settlement.
- Unfinalized/ambiguous/missing evidence => PENDING or UNAVAILABLE, never guessed.

## 4. Geographic model

### 4.1 Privacy boundary
The dashboard SHALL aggregate by administrative area. Default API responses MUST NOT expose:
- full street address
- door number
- phone/email
- exact lat/lng

### 4.2 New tables/read models

`member_geo_profile`
- member_id
- country_code
- postal_code
- city_code / city_name
- district_code / district_name
- normalized_address (restricted)
- latitude / longitude nullable (restricted)
- geo_source
- geo_confidence
- geo_status: PENDING | NORMALIZED | PARTIAL | FAILED | MANUAL_CONFIRMED
- address_hash
- normalized_at / created_at / updated_at

`geo_admin_area`
- country_code
- level
- area_code
- parent_area_code
- area_name_zh / area_name_en
- region_group: NORTH | CENTRAL | SOUTH | EAST | ISLAND
- sort_order
- is_active

Optional scale projection:
`geo_daily_snapshot`
- snapshot_date
- root_qualification_id
- branch: ALL | LEFT | RIGHT
- city_code
- district_code
- balls
- members
- active_balls
- new_balls
- gpv
- definition_version
- source_watermark

## 5. Backend service contract

Create module: `organization-geo`

Base route:
`/api/admin/v1/organization/geo`

Endpoints:

### GET /summary
Query:
- rootQualificationId
- side=ALL|LEFT|RIGHT
- dateFrom/dateTo
- asOf
- knowledgeCutoff

Response:
- descendantBalls
- uniqueMembers
- activeBalls
- activeRate
- newBalls
- totalGpv
- unlocatedBalls
- lastUpdated
- definitionVersion
- sourceWatermark

### GET /distribution
Query:
- rootQualificationId
- side
- level=CITY|DISTRICT
- parentAreaCode optional
- metric=BALLS|MEMBERS|ACTIVE_BALLS|NEW_BALLS|GPV
- dateFrom/dateTo/asOf/knowledgeCutoff

Rows:
- areaCode/areaName
- members
- balls
- activeBalls
- activeRate
- newBalls
- gpv
- status

### GET /branch-comparison
Return LEFT and RIGHT by region_group with Ball counts and GPV.

### GET /trend
- metric=BALLS|MEMBERS|ACTIVE_BALLS|NEW_BALLS|GPV
- interval=DAY|WEEK|MONTH

### GET /top-markets
- metric
- limit <= 20

### GET /export
Asynchronous or paginated export using the exact same authorized context. No PII by default.

## 6. Reuse existing authoritative sources

Geo Analytics SHALL reuse:
- Binary ancestry/firstSide from the existing tree read model/projection.
- GPV source semantics from `binary-tree-metrics.ts`.
- Active state from authoritative qualification/Active evidence.
- Carry/pairedPv only from finalized/replayed Binary settlement evidence.

The module MUST NOT call Bonus settlement calculators for read-time analytics.

## 7. Admin UI

Route proposal:
`/organization/geo`

Components:
- GeoFilterBar
- GeoSummaryCards
- TaiwanChoroplethMap
- BranchComparisonChart
- GeoInsightPanel
- TopMarketChart
- GeoTrendChart
- GeoDistributionTable
- GeoExportButton

Filters:
- Root Ball/Qualification search
- scope: whole descendant subtree
- date range: 30d / 90d / YTD / ALL / custom
- metric: Balls / Members / Active Balls / GPV / New Balls
- branch: ALL / LEFT / RIGHT

Map drill-down:
Taiwan -> City -> District.

Tooltip:
- members
- balls
- activeBalls
- activeRate
- newBalls
- GPV

All labels use GPV. No BV label is allowed.

## 8. Deterministic insight rules

R1.1 does not use AI to create management conclusions.

Examples:
- top 3 cities share > 50% => concentration message
- RIGHT SOUTH share exceeds LEFT SOUTH share by configured descriptive threshold => branch distribution message
- top 3 30-day newBall growth areas => growth message

Insights are descriptive only and MUST cite the underlying metric period and basis.

## 9. RBAC

Capabilities:
- ORG_GEO_VIEW
- ORG_GEO_DRILLDOWN
- ORG_GEO_EXPORT
- ORG_GEO_MEMBER_LOOKUP

Default geo APIs return aggregates only.
Member identity/address detail requires a separately authorized member lookup flow.

## 10. Acceptance tests

GEO-01 Descendant count equals authoritative Binary subtree count; root self excluded by default.
GEO-02 LEFT+RIGHT descendant Ball counts equal total descendant count.
GEO-03 Same Person with three Balls => balls=3, uniqueMembers=1.
GEO-04 LEFT/RIGHT partition equals historical firstSide from Binary ancestry.
GEO-05 GPV totals reconcile to distinct GPV source events + approved corrections once; no propagated-row double count.
GEO-06 No BV-based field is used for L/R performance, map performance or trend performance.
GEO-07 Carry and Pair equal finalized/replayed Binary settlement evidence exactly.
GEO-08 Missing address contributes to unlocatedBalls and never disappears silently.
GEO-09 Address update re-normalizes geo profile without changing historical placement facts.
GEO-10 Active counts reconcile to authoritative Active evidence at the same checkpoint.
GEO-11 Map, Top 10, summary, table and export reconcile under identical filters/context.
GEO-12 Unauthorized users cannot enumerate another root scope or retrieve PII.
GEO-13 API never returns full address or exact coordinates in aggregate endpoints.
GEO-14 Return/replay changes GPV historical latest-known views according to existing knowledge-cutoff semantics.
GEO-15 Large/skewed tree query is server-side bounded/cached; no browser recursion.

## 11. Release gate

- DB migration PASS
- Geo normalization PASS
- Binary subtree/firstSide reconciliation PASS
- GPV reconciliation PASS
- Active reconciliation PASS
- Carry/Pair source reconciliation PASS
- RBAC/privacy PASS
- Export equivalence PASS
- Desktop/mobile UAT PASS
- Performance benchmark PASS
- Existing R1.0B Golden/Replay/Return/Carry gates remain green

## 12. Non-goals

This release does NOT:
- change R1.0B rule/economic outcomes
- create a new BV volume
- alter Binary Pair, Carry, K1/K2 or cap logic
- expose member homes as map pins
- infer Sponsor geography as Binary geography
- introduce AI ranking or automatic market decisions
