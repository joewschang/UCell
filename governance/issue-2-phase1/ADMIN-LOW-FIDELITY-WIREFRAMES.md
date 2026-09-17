# Admin low-fidelity wireframe specification

Primary widths: 1366, 1440 and 1920 px; tablet fallback at 768 px. These layouts preserve routes and permissions.

## Global shell

```text
┌───────────────┬──────────────────────────────────────────┐
│ Domain nav    │ UCell Operations Console  Role · Env     │
│ collapsible   ├──────────────────────────────────────────┤
│ role-filtered │ Environment / release disclosure         │
│               │ PageHeader: title, scope, primary action │
│               │ State slot / content                     │
│ Actor/session │                                          │
└───────────────┴──────────────────────────────────────────┘
```

Unauthorized navigation requires an explicit 403 explanation in the future; current redirect behavior is recorded as a gap.

## Dashboard

```text
[PageHeader + authoritative as-of/source]
[Person] [Qualification] [Current Active] [Pending applications]
[Today / month bounded facts] [Release state]
[NASL unavailable] [GMV unavailable]
[Organization health unavailable] [Settlement/security unavailable]
```

Cards show source, scope, as-of and authority status. Date metrics require the versioned Asia/Taipei calendar before Production authority.

## Master-detail

Applies to People, Qualifications, Applications, Orders, Returns, Workflows and Payouts.

```text
[PageHeader + allowed action]
[Filter/search/status/period]
┌──────────────────────────┬───────────────────────────────┐
│ Bounded grid/list        │ Detail pane or Drawer         │
│ ID / status / owner/time │ overview / evidence / history │
│ pagination disclosure    │ tabs when domain requires     │
└──────────────────────────┴───────────────────────────────┘
[CommandBar: role check + confirm reason + busy lock]
```

## Configuration

Applies to Products, Packages, Content and Documents.

```text
[Inventory / versions] [Create or new-version form]
[DRAFT → APPROVED → EFFECTIVE lifecycle]
[Rule/version/hash/approval/effective window]
[Role-separated actions]
```

Published or sealed versions remain immutable.

## Organization

```text
[Root Qualification search]
[Sponsor | Binary] [Historical at] [Depth]
[Tree-kind semantic notice]
[Lazy tree canvas]
[Selected node evidence drawer]
```

Tree choice fixes the semantics. No placement mutation appears unless an authorized Backend workflow exists.

## Bonus and settlement

```text
[Period + exact settlement batch]
[Frozen][Active][K0][K1][K2][Pools][45D][Payable]
[Selected stage drawer]
 Rule version / parameter hash / input / output
 exceptions / executedAt / replay / audit
[Settlement, pool, reservoir and Qualification drill-down]
```

Missing evidence stays unavailable. Current-holder information never substitutes for historical recipient evidence.

## Governance, reports and readiness

```text
[Filter / source / as-of]
[Authoritative results or explicit local/static label]
[Detail or evidence export]
```

- Audit is immutable event master-detail.
- Reports expose read-only aggregates and alerts.
- UAT separates local helper records from formal sign-off evidence.
- System clearly labels static inventory and does not claim a live release gate.
