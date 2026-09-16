# Route matrix

| App | Existing route | UX-1 |
|---|---|---|
| Member | / | Dashboard |
| Member | /organization | Sponsor/Binary tabs |
| Member | /bonuses | Bonus/lifecycle/ledger |
| Member | /performance, /shop, /orders, /notifications, /me | Preserved, shared theme bridge |
| Admin | / | Operations Dashboard |
| Admin | /people | Person grid/detail drawer |
| Admin | /qualifications | Existing authoritative detail preserved; theme bridge |
| Admin | /bonuses | Settlement/pools/Award drawer |
| Admin | /applications, /applications/new, /products, /orders, /organization, /subscriptions, /returns, /workflows, /payouts, /documents, /audit, /reports, /uat, /system | Preserved and role-filtered |

Conceptual navigation groups must map to these existing modules. Grouped sidebar is implemented with existing route entries and the original canOpen authorization filter; no invented endpoints/routes.

## UX-2 refinement

UX-2 preserves existing routes and permission checks. QualificationDetail Audit is lazy and role-gated. Additive GET /api/v1/admin/persons/:personId/qualifications provides exact owned rows. No monetary mutation route added.
