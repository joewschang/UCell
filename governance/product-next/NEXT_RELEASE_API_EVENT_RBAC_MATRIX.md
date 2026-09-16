# UCell Next Release API / Event / RBAC Matrix
Status: DESIGN FREEZE CANDIDATE
Date: 2026-09-17

## API conventions
Existing UCell envelope/auth/error conventions. Current member auth LINE OA/LIFF. Mutations idempotent where needed. Server owns price, package version, product eligibility, Sponsor/Binary legality and monetary recognition.

## Member package discovery/selection
GET /api/v1/member/packages?class=QUALIFICATION|ACTIVE_DURATION -> active server-authoritative package versions; returns packageVersionId, displayName, class, price/currency, selectableProductQuantity, effects, sales/effective status and safe summary. No client-derived price/PV/BV.
GET /api/v1/member/packages/:packageVersionId/products -> eligible selectable ProductProfile/SKU versions with display data, availability and min/max/increment constraints.
POST /api/v1/member/package-selections/validate -> packageVersionId,targetQualificationId? and selections[{productProfileId/productVersionId,quantity}]; returns VALID or field/policy errors plus authoritative selection summary. Validation is advisory until checkout revalidation.
POST /api/v1/member/orders (existing authoritative order flow) accepts packageVersionId, targetQualificationId? and product selections; Backend revalidates effective version, exact quantity, eligible products, price, recognition config and availability; persists PackagePurchaseSnapshot/Selections.

QUALIFICATION package purchase feeds Batch-3 Formal Member/Ball setup. ACTIVE_DURATION package requires/derives owned target Qualification under policy and never creates Ball or changes Person referrer/Sponsor/Binary.

## Admin package management
GET /api/v1/admin/packages
POST /api/v1/admin/packages -> create stable package identity.
POST /api/v1/admin/packages/:id/versions -> DRAFT version.
GET/PATCH /api/v1/admin/package-versions/:id -> edit DRAFT only.
PUT /api/v1/admin/package-versions/:id/selectable-products -> configure eligible products/min/max/increment/order.
POST /api/v1/admin/package-versions/:id/preview -> render/validate Member-facing configuration without publication.
POST /api/v1/admin/package-versions/:id/approve -> PACKAGE_CONFIG_APPROVE.
POST /api/v1/admin/package-versions/:id/schedule -> effective window.
POST /api/v1/admin/package-versions/:id/activate -> controlled activation if policy permits.
POST /api/v1/admin/package-versions/:id/retire -> future/no-new-sales; historical orders unaffected.
GET /api/v1/admin/package-versions/:id/diff?against= -> version diff.
GET /api/v1/admin/package-versions/:id/usage -> order/selection usage read model.

Initial configured data: 啟航 14,400/3; 菁英 43,200/9; 領袖 72,000/15; 季活躍 6,000/2; 半年活躍 12,000/4; 年活躍 24,000/8.

## Ball setup/placement
Qualification setup, Sponsor selection/confirmation, Sponsor-owner placement, 72h overdue and Admin override APIs remain Batch 3. Ball #2+ own-Ball sponsorship allowed without Person referrer mutation.

## Referral / formal / KYC / V1.2/V1.3
Remain as approved. Referral attribution may prefill Sponsor but final selection is member-editable before confirmation. KYC alone does not create Formal Member; qualifying package evidence required.

## Event additions
PACKAGE_VERSION_CREATED/APPROVED/SCHEDULED/ACTIVATED/RETIRED: package/profile version, configHash, actor, effective window.
PACKAGE_SELECTABLE_PRODUCTS_CHANGED: draft packageVersionId, selection config hash; never rewrites published historical snapshot.
PACKAGE_SELECTION_VALIDATED optional operational event (avoid analytics noise unless useful).
PACKAGE_PURCHASED: personId,orderId,packagePurchaseSnapshotId,packageVersionId,packageClass,targetQualificationId?,selectedProductSummary IDs/qty, recognition config reference; no unnecessary price duplication if Core order event is canonical.
QUALIFICATION_ACTIVE_ENTITLEMENT_CREATED: qualificationId,packagePurchaseSnapshotId,periodStart,periodEnd,policyVersion.
Existing Formal Member/Qualification Sponsor/Placement events remain.

## Package RBAC
MEMBER: read active packages/products; select products; purchase; target only owned Qualification where required.
OPERATIONS/PACKAGE_CONFIG_VIEW: read package config/usage.
PACKAGE_CONFIG_MANAGE: create package and edit DRAFT versions/selectable products; cannot rewrite ACTIVE/used version.
PACKAGE_CONFIG_APPROVE: approve/schedule/activate/retire under separation policy; preferably distinct principal from author in Production.
FINANCE: read price/recognition references as needed; no unilateral package mutation unless separately granted.
AUDITOR: read versions/diffs/approval/history.
SUPER_ADMIN: break-glass audited.

## Server validation invariants
Exact selected quantity for initial EXACT_QUANTITY mode. Every selected product eligible under package version and per-SKU constraints. Package effective/sale window valid. Client stale version fails with PACKAGE_VERSION_STALE/NOT_SELLABLE. Missing recognition config on monetary path -> CONFIGURATION_PENDING/fail closed; do not guess PV/BV. Active package target must be owned/eligible Ball. Historical PackagePurchaseSnapshot immutable.

## Contract tests
Admin draft/version/approval separation; cannot edit used/active version; version effective boundary; member package list only sellable versions; mixed selections 3/9/15/2/4/8; duplicate SKU aggregation; min/max/increment; stale client; concurrent config publication/checkout; server price tamper; product eligibility tamper; active-package target BOLA; qualification package enters Ball setup; active package creates entitlement only; no referrer/Sponsor/Binary mutation; missing recognition config fail closed; historical snapshot readback.