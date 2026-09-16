# V1.4 Configurable Package Core Report

## Delivered

- Added versioned PackageProfile, PackageProfileVersion, selectable-product pool, immutable purchase snapshot/selection, and active-entitlement evidence schemas.
- Added six approved packages as DRAFT database seed configuration. Prices and selectable quantities are not frontend constants.
- Added Admin APIs for package identity/version creation, selectable-product configuration, approval, scheduling, activation, retirement, and listing.
- Added Member APIs for sellable package discovery, eligible products, and authoritative selection validation.
- Exact quantity, duplicate-row aggregation, per-product limits/increments, active window, recognition configuration, and target Qualification ownership are validated server-side.
- Product-pool configuration is included in the package config hash.
- Published configuration and historical purchase evidence are protected by database immutability triggers.
- Production approval uses separate `PACKAGE_CONFIG_MANAGE` and `PACKAGE_CONFIG_APPROVE` role codes; self-approval is denied by Core.

## Boundaries

- Initial package versions remain DRAFT until eligible product profiles and an approved recognition configuration are attached and approved.
- This slice validates package selection but does not yet create the package Order/PurchaseSnapshot transaction or downstream Qualification setup/active entitlement.
- PV/BV and eligible consumption are never inferred from package price or selected retail totals.

## Verification

- Backend and Worker builds: PASS.
- Prisma validate/generate: PASS.
- Fresh isolated DB: 38 forward-only migrations deployed and cleaned up.
- Package configuration Golden: 19 assertions PASS for seed values, versioning, product-pool hashing, approval separation, mixed/exact selection, immutable publication, recognition fail-closed, target-Ball BOLA, and no organization mutation.
- Existing placement, System Assignment, membership, return/replay, Member/Admin, identity, content, and formal-application DB journeys remain PASS.
- Backend Jest on a fresh migrated disposable database: 17 suites PASS, 186 tests PASS, 3 existing TODO.
- OpenAPI, schema, migration, static, and security-policy preflights: PASS.
