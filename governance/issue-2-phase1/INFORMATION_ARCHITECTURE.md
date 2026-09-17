# Information architecture

## Member

```text
LINE LIFF authentication
└─ Person session
   ├─ Person-level
   │  ├─ Member account and profile
   │  ├─ Network registration
   │  ├─ Formal-member application
   │  ├─ Delivery profile
   │  └─ Session logout
   └─ Qualification context (one of N balls)
      ├─ Home: Active, repurchase, PV/RPV/EPV, bonus
      ├─ Organization: Sponsor / Binary
      ├─ Performance
      ├─ Bonuses and append-only ledger
      ├─ Commerce: retail / Qualification / Active-duration packages / orders
      ├─ Content
      └─ Notifications
```

Primary bottom navigation remains Home, Organization, Shop, Bonuses and My Account. Performance, Orders, Content and Notifications are secondary destinations. Person-level pages remain available when no Qualification exists; scoped pages require server-verified ownership.

## Admin

| Domain group | Routes | Primary objects |
|---|---|---|
| Dashboard | `/` | Operational read models |
| Member management | `/people`, `/applications`, `/applications/new`, `/qualifications`, `/workflows` | Person, application, Qualification |
| Organization | `/organization` | Sponsor/Binary temporal evidence |
| Commerce | `/products`, `/packages`, `/orders`, `/subscriptions`, `/returns` | Product profile, package, order, schedule, return |
| Bonus center | `/bonuses` | Settlement pipeline, Award, ledger |
| Finance | `/payouts` | Payable, payout batch, recovery |
| Analysis | `/reports` | Read-only reports and integrity alerts |
| Governance | `/content`, `/documents`, `/audit`, `/uat`, `/system` | Content, evidence, audit and readiness reference |

## Cross-surface boundaries

| Object | Member | Admin | Authority |
|---|---|---|---|
| Person | Own profile/session/registration | Search, inspect and governed lifecycle | Identity/membership facts |
| Qualification | Select owned ball and read scoped data | Create/inspect/govern 1:N balls | Temporal ownership/status |
| Sponsor Tree | Sponsor and referrals | Historical Sponsor inspection | Sponsor evidence |
| Binary Tree | Left/right summary | Historical Binary inspection/authorized placement | Binary evidence |
| Product/order | Select and submit authorized order | Configure references, inspect and confirm payment | Versioned product profile and Core order |
| Bonus/ledger | Read amount/status/history | Inspect pipeline, settlement and evidence | Monetary engine and append-only ledger |
| Return/replay | Read resulting states | Govern lifecycle and inspect recovery | Return/replay/recovery services |
| Content | Consume approved content | Version, approve and publish | Content service |

## Navigation rules

1. Every Member organization, performance, bonus, ledger and order page identifies the current Qualification.
2. Person-level data never inherits a ball identifier.
3. Sponsor and Binary views never share labels, data structures or mutations.
4. Admin navigation follows `canOpen()`; link visibility never replaces Backend authorization.
5. Missing operational data stays visible as unavailable when absence affects a decision.
6. UI labels must not imply finalized money, lifecycle stage or evidence that the API did not supply.
