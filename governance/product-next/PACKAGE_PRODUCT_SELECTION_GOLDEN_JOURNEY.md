# UCell Package Management / Member Product Selection Golden Journeys
Status: ACCEPTANCE BASELINE
Date: 2026-09-17

## Golden P1 — Admin publishes 啟航 version
Authorized package manager creates DRAFT 啟航 version price NTD 14,400, EXACT_QUANTITY=3, class QUALIFICATION, effects configured, recognitionConfigRef present. Admin selects eligible main products and optional per-SKU limits. Preview validates. Authorized approver approves/schedules. At effective time Member API exposes this exact version. Config hash/version retained.

## Golden P2 — Member self-selects products
Member opens 啟航; Backend returns selectable pool. Member selects total exactly 3, e.g. TIP-A x1 + TIP-B x2. UI shows 3/3 and server validate succeeds. Checkout revalidates active package version, price, eligibility and quantity. Order persists immutable PackagePurchaseSnapshot + selections. Subsequent Formal Member/Ball setup follows Batch 3.

## Golden P3 — Mixed selection
If no SKU max blocks it, member may choose three different eligible products or multiples of one SKU. Backend aggregates duplicate SKU rows and validates total quantity. UI counter is convenience only; Backend authoritative.

## Golden P4 — Invalid quantity/product
啟航 member selects only 2 or 4 total, or an SKU not enabled for package version. Server rejects. Client cannot override by changing request JSON. No order/payment/Qualification evidence is created from invalid selection.

## Golden P5 — Admin changes future package
After historical orders exist, Admin cannot edit their PackageProfileVersion. Create new version with new price/product pool/effectiveFrom. Old order continues to display original package/product selections. New purchases after boundary use new version only.

## Golden P6 — 季活躍
Existing Formal Member chooses 季活躍 price 6,000, target owned Ball Q1, and exactly 2 eligible products. Purchase snapshot preserves price 6,000 and product selections. System creates QualificationActiveEntitlementEvidence under approved active policy. It creates no new Ball and changes no Person referrer, Sponsor or Binary relationship.

## Golden P7 — Active package product retail total differs from payment
Two selected main products may each have retail/display price 4,800 while package payment is 6,000. System never calculates PV/BV/eligible consumption by multiplying retail price or assuming package price. It uses explicit recognitionConfigRef. Missing config blocks monetary recognition with CONFIGURATION_PENDING; historical order/package evidence remains.

## Golden P8 — Stale client/config race
Member loads package version V1. Admin publishes/switches to V2 before checkout. Checkout validates whether V1 is still sellable under its effective/sales window. If not, return PACKAGE_VERSION_STALE/NOT_SELLABLE and require reload; never silently convert selections/price to V2.

## Golden P9 — Admin RBAC
PACKAGE_CONFIG_MANAGE can edit DRAFT but cannot approve if separation-of-duties policy forbids self-approval. Unauthorized Admin cannot mutate. Every publish/approve/retire action audited with before/after hash/version.

## Golden P10 — Six initial packages
Seed/config verification: 啟航 14,400/3; 菁英 43,200/9; 領袖 72,000/15; 季活躍 6,000/2; 半年活躍 12,000/4; 年活躍 24,000/8. Display name exactly 啟航. These values come from DB version configuration, not frontend constants.

## Required UI behavior
Package cards show server price and selectable count. Product picker shows eligible products only, +/- quantity, selected/required counter, validation messages and review summary. Qualification active packages prompt target Ball when needed. Checkout review shows package, selected products and total payable package price. Do not show inferred PV/BV unless authoritative API provides it under approved policy.

## Required assertions
Zero hardcoded business parameters in Member UI; immutable snapshots; server-authoritative selection/price; version boundary deterministic; no active-package Ball creation; qualification package integrates Batch-3 setup; no monetary inference from retail values.