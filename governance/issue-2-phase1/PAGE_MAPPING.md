# Page mapping

## Baseline convention

The 35-page presentation contains 31 product UI states and 4 explanatory slides. Product coverage is 10 Member pages plus 21 Admin pages including login. Conditional workflows embedded inside pages are listed separately.

## Member pages

| Route | Page / task | API and read model | Authority / states |
|---|---|---|---|
| `/` | Home | `GET qualifications`, `POST context/qualification`, `GET dashboard`, `GET repurchase/status` | Authoritative with pending bonus fields; loading/error/null money/no-Qualification |
| `/organization` | Sponsor/Binary organization | `GET organization/sponsor`, `GET organization/binary`, `POST share-links` | Sponsor/Binary topology separated; Binary volume, Carry and full viewer pending |
| `/performance` | Period performance | `GET performance?q&period` | PV/RPV/EPV authoritative; left/right settlement fields pending |
| `/bonuses` | Award lifecycle and ledger | `GET bonuses`, `GET bonuses/ledger` | Finalized disclosure and append-only recovery; null means pending |
| `/shop` | Products, cart, delivery, packages | `GET products`, `GET/PATCH delivery-profile`, package endpoints, `POST orders`, `GET order/:id` | Core price authoritative; PV/fulfillment may be pending; 409/422/idempotency |
| `/orders` | Qualification-scoped orders | `GET orders`, `GET orders/:id` | Order/payment authoritative; fulfillment may be pending |
| `/content` | Published content | `GET content` | Published content authoritative; mock has no fixture |
| `/content/:id` | Content detail/share | Current frontend loads content list and finds ID; Backend also exposes content detail | Not found fails closed; share only when permitted |
| `/notifications` | Notice list/read state | `GET notifications`, `PATCH notifications/:id/read` | Person/owned Qualification audience; append-once read evidence |
| `/me` | Person account | `GET me`, `PATCH profile`, `POST logout` plus conditional registration/formal endpoints | Person-level only; session and form states |

### Embedded/conditional Member flows

| Parent | Flow | APIs | Baseline coverage |
|---|---|---|---|
| `/me` | Network registration | required contracts, consent, network registration | Functional code/tests; absent from screenshots |
| `/me` | Formal member application | formal contracts, consent, formal application draft | Functional code/tests; absent from screenshots |
| `/shop` | Delivery profile | `GET/PATCH delivery-profile` | Connected flow absent from mock screenshots |
| `/shop` without Qualification | First Qualification package | Qualification packages/products and `POST orders` | Conditional flow absent from screenshots |
| `/shop` with Qualification | Active-duration package | Active-duration packages/products and `POST orders` | Conditional flow absent from screenshots |
| organization/content | Referral/content share | `POST share-links` | Conditional result absent from screenshots |

All scoped reads revalidate Person ownership in Backend. Client-supplied ownership is never trusted.

## Admin pages

| Route | Page | Main APIs / data | Roles and status |
|---|---|---|---|
| `/login` | Admin login | `/auth/admin/entra/exchange`, `/me`, `/logout` | Public entry; formal credential pending; DEV mode disclosed |
| `/` | Operations summary | `GET /admin/dashboard/summary` | All Admin roles; narrow authoritative summary plus unavailable planned sections |
| `/people` | Person master-detail | persons list/create, person Qualifications | Super Admin, Membership Ops, Compliance; LINE/KYC unavailable |
| `/applications` | Application queue/detail | membership applications, formal applications | Super Admin, Membership Ops, Compliance; mutation confirmation |
| `/applications/new` | Four-step application wizard | persons, Qualifications, placement preview, create application | Super Admin, Membership Ops |
| `/qualifications` | Qualification master-detail | qualification detail, operations, audit | Super Admin, Membership Ops, Compliance; 10 detail tabs |
| `/products` | Product reference | admin products | Super Admin, Order Ops, Compliance; prospective PV/BV terminology gap |
| `/packages` | Package configuration | package/version/products/approve/schedule/activate/retire | Manage/approve role separation |
| `/orders` | Orders/payment | admin orders/products/Qualifications/payment confirmations | Super Admin, Order Ops, Finance, Compliance |
| `/organization` | Temporal organization | Qualification search, separate Sponsor/Binary tree endpoints | Super Admin, Membership Ops, Compliance; `at` and depth |
| `/subscriptions` | Subscription schedules | plans, subscriptions, detail, create/cancel contracts | Production calendar values remain configuration pending |
| `/bonuses` | Settlement pipeline | compensation, settlements, pools, reservoir, qualification ops, award detail | Super Admin, Finance, Compliance; stored evidence only |
| `/returns` | Return/reversal/replay | returns queue/detail, orders, reversal, replay | High-risk idempotent mutations; POSTED trigger remains Core-owned |
| `/workflows` | Upgrade/transfer/exit | workflow queue/detail/create/approve | Super Admin, Membership Ops, Compliance |
| `/payouts` | Payable/payout/recovery | payout batches, recoveries, approvals, export, mark-paid | Finance/Compliance separation |
| `/content` | Content/version/publish | admin content endpoints | Super Admin, Order Ops, Compliance |
| `/documents` | Immutable attachment metadata | ops-ready attachment endpoints | Super Admin, Membership Ops, Order Ops, Compliance |
| `/audit` | Audit search/detail | audit events | Super Admin, Compliance |
| `/reports` | Reports/integrity/export | operations report, alerts, export | Super Admin, Finance, Compliance |
| `/uat` | Local UAT helper | Browser local storage and JSON export | `LOCAL_ASSISTIVE_ONLY`; not formal UAT evidence |
| `/system` | Static readiness reference | Static `backendRoutes` and gaps | `STATIC_REFERENCE_DRIFT`; not release authority |

## Read-model gaps

| Gap | Current UI | Required future contract boundary |
|---|---|---|
| Member Binary volume/Carry/full tree | Null/pending/unavailable | Stored settlement/tree evidence, selected Qualification and period |
| Member performance left/right | Null with pending settlement | Explicit source, period and settlement status |
| Member product PV | Null | Versioned independent PV/BV product profile |
| Admin NASL lifecycle | Unavailable | Person lifecycle read model, not Qualification Active |
| Admin GMV/returns | Unavailable | Approved inclusion/currency/business-period definitions |
| Organization health | Unavailable | Separate Sponsor/Binary measures and approved alert thresholds |
| Settlement/security health | Unavailable | Stored evidence with as-of/source/scope and RBAC |
| Production date boundaries | Narrow dashboard uses runtime-local dates | Versioned Asia/Taipei OperationalCalendar |

## API inventory caveat

`backend/openapi.generated.json` currently contains 123 paths. `admin/src/lib/routes.ts` contains 74 static route strings and is not an API source of truth. The System page must not present that registry as complete or as a live release gate.

Phase 2 disposition: the System page now labels this list as an Issue #2 Phase 1 static snapshot, shows its audit date, scope and OpenAPI source, and exposes the measured 123-path/134-operation drift. A contract test locks the audited counts and requires the documented OpenAPI operation count to exceed the curated UI list; runtime code does not invent or infer readiness evidence.
