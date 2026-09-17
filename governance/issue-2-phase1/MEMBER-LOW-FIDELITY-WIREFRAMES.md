# Member low-fidelity wireframe specification

Target widths: 375, 390 and 430 px. These wireframes specify hierarchy and states, not final visual design.

## Global shell

```text
┌────────────────────────────┐
│ UCell 會員服務      通知(n) │
├ DEV banner, local only ────┤
│ 目前經營資格 [Q…｜球 n ▼]   │
│ 以下資料均屬此資格           │
├────────────────────────────┤
│ Page header + Qualification │
│ Page state / page content   │
├────────────────────────────┤
│ 首頁  組織  商城  獎金  我的 │
└────────────────────────────┘
```

The state slot below the page header supports Skeleton, Empty, Error/retry, 403, 409, 422, Session Expired, Offline, Unavailable and Pending. Switching Qualification clears/unmounts old private views before new data appears.

## Home

```text
[Member identity + current Q/ball]
[Qualification Active] [Monthly repurchase]
[PV] [RPV] [EPV]
[Bonus current status + MoneyState]
[Collapsed repurchase evidence]
[2-column quick actions]
```

## Organization

```text
[Header + Q badge]
[推薦組織] [二元安置組織]

Sponsor tab:                 Binary tab:
[Sponsor summary]            [Left count / Core volume / Carry]
[Direct referrals]           [Right count / Core volume / Carry]
[Referral share]             [Tree viewer unavailable/CTA]
```

The two tabs never reuse the same node schema or imply editable placement.

## Performance

```text
[Header + Q badge]
[Month selector + period note]
[PV] [RPV] [EPV]
[Left Core volume] [Right Core volume]
[as-of / settlement evidence status]
```

## Bonuses

```text
[Header + Q badge]
[Month selector]
[Award name] [Chinese current state]
[MoneyState]
[CALCULATED—45D—EFFECTIVE—PAYABLE—PAID]
[Detail disclosure: enum/rule/parameter/calendar/hash]
[Append-only ledger/reversal/clawback list]
```

Only the current evidenced lifecycle stage receives emphasis.

## Shop and orders

```text
[Header + Q badge]
[Delivery readiness / edit]
[General products]
[Qualification package, conditional]
[Active-duration package, conditional]
[Sticky cart: items only, no client total/PV]
[Server-priced confirmation / receipt]
[Order detail: payment / fulfillment / return]
```

On retry after an uncertain response, retain the original idempotency key and entered data.

## Content

```text
List:   [Header] [Published content cards] [Empty/error]
Detail: [Back] [Type/title/summary] [External HTTPS CTA]
        [Published time] [Share, only when allowed]
```

## Notifications

```text
[Header + Q badge]
[Server-sync / no LINE push note]
[Category filter] [Unread filter]
[Notice audience: Person-wide or current Q]
[Read action with busy/error]
```

## My account

```text
[Person identity and membership state]
[Editable contact fields]
[Network registration, conditional]
[Formal application, conditional]
[Owned Qualifications list]
[Session controls]
```

Person fields and Qualification fields never share an edit form.

## No-Qualification onboarding

```text
[Why scoped pages are unavailable]
[Person profile / required contracts]
[Delivery profile]
[Qualification packages]
[Server-authoritative product selection]
[Pending-payment receipt]
[Refresh owned Qualifications]
```
