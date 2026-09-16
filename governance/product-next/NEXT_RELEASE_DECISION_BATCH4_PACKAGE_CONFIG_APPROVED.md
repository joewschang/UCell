# UCell Next Release Decision Register — Batch 4 Configurable Package / Product Selection
Status: APPROVED DESIGN BASELINE
Date: 2026-09-17
Scope: membership qualification packages and active-duration packages. Monetary PV/BV recognition remains governed by approved Core rules and package/product version configuration; no unapproved PV/BV inference is made here.

## 1. Package classes
QUALIFICATION packages: 啟航, 菁英, 領袖. A qualifying purchase may support Formal Member eligibility and create a new Qualification/Ball setup according to Batch 3.
ACTIVE_DURATION packages: 季活躍, 半年活躍, 年活躍. These apply an approved active-duration entitlement to a target existing Qualification and do not create a new Ball or change Person referrer.

## 2. Initial approved commercial parameters
啟航: price NTD 14,400; selectable main-product quantity 3.
菁英: price NTD 43,200; selectable main-product quantity 9.
領袖: price NTD 72,000; selectable main-product quantity 15.
季活躍: price NTD 6,000; selectable main-product quantity 2; duration candidate/semantic = quarter according to approved active policy.
半年活躍: price NTD 12,000; selectable main-product quantity 4; duration = half-year according to approved active policy.
年活躍: price NTD 24,000; selectable main-product quantity 8; duration = year according to approved active policy.

Package display name is 啟航 (not 啟帆).

## 3. Admin-configurable, versioned PackageProfile
Do not hardcode the six packages in calculation/UI code. Admin manages versioned PackageProfile subject to RBAC/approval.
Fields at minimum: packageId/code, displayName, packageClass, priceCurrency, priceAmount, selectableProductQuantity, qualificationEffect, membershipEffect, activeDurationUnit/value?, effectiveFrom/effectiveTo, salesWindow?, memberEligibility?, targetQualificationRequired, status DRAFT|SCHEDULED|ACTIVE|RETIRED, ruleVersion/configVersion, configHash, createdBy/approvedBy/approvedAt.
Published/used versions are historical evidence; edits create a new version and never rewrite an order's package snapshot.

## 4. Selectable product pool
Admin configures which main-product SKUs/versions are eligible for each PackageProfile version through PackageSelectableProduct(packageVersionId, productProfileId/SKU, enabledFrom/To, minQty?, maxQty?, selectionIncrement?, status, sortOrder).
Front-end selection is server-driven from the active package version. Member may mix eligible products unless a package version explicitly defines per-SKU min/max constraints. Sum of selected quantities must equal `selectableProductQuantity` exactly unless a future package rule explicitly allows another selection mode.

Example: 啟航 quantity=3 may select A+A+B, A+B+C, or three of one eligible SKU if SKU max constraints allow it.

## 5. Front-end purchase flow
Package card -> package detail -> choose exactly allowed quantity from server-returned eligible product pool -> show selection counter/remaining quantity -> validate -> cart/order confirmation -> authoritative server price/package snapshot -> payment -> applicable Formal Member/Ball or Active-duration workflow.
Frontend never derives package price, PV/BV or eligibility from `4800 x quantity`.

## 6. Order snapshot
Order/line must preserve PackagePurchaseSnapshot: packageVersionId/code/name/class, price/currency, selectableQuantity, selected ProductProfile/SKU versions and quantities, qualification/active effects, applicable rule/config hashes and effective timestamp. Later Admin package/product edits do not change historical orders.

## 7. PV/BV / recognition boundary
The stated NTD 4,800 is the main product retail/display price, but package payment amounts and selectable product retail totals differ for Active-duration packages. Therefore DO NOT infer PV/BV/eligible-consumption from product retail sum or package price. Each package/product version must reference explicit approved recognition configuration. If missing, affected monetary recognition FAILS CLOSED while order/package evidence remains intact.

## 8. Active-duration targeting
季/半年/年活躍 requires selecting/confirming the target Qualification owned by the member unless policy uniquely determines it. Purchase does not create a new Qualification and does not modify Person.referrerMemberId or Sponsor/Binary history. Exact stacking/start-date/renewal semantics remain governed by the active-policy SSOT and must be versioned.

## 9. Admin UI
Add Package Management: list/status/version/effective window; create new version; set class/price/selectable qty/effects; configure selectable products and per-SKU limits; preview Member view; schedule/activate/retire; view usage/order history; diff versions; audit approval. Production changes require appropriate permission (e.g. PACKAGE_CONFIG_MANAGE + PACKAGE_CONFIG_APPROVE separation where feasible).

## 10. Validation
Cannot activate package with zero/invalid price, missing selection quantity, no selectable products (unless explicit no-product mode), invalid effective window, contradictory effects, or missing required recognition config for monetary path. Product selection server validates active package version, eligible SKU version, quantities and availability policy at checkout.

## 11. Initial seed vs hardcode
The six approved packages are initial configuration/seed data, not enums that prevent future packages. Stable package codes may exist, but business parameters live in versioned DB configuration.

## 12. Tests
Admin create/version/schedule/retire; unauthorized config denial; historical snapshot immutability; package version boundary; member mixed product selection exact quantity; per-SKU limits; stale client selection after Admin version change; ordinary product not qualification package; 啟航/菁英/領袖 enter Batch-3 Ball workflow; active packages target existing Ball only; no Person-referrer mutation; missing recognition config fail-closed; concurrent checkout/config publication; audit/hash reconciliation.