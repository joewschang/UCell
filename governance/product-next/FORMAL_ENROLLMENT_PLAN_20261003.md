# Network Member → Formal Member enrollment

Product Owner authority: two entry routes (qualification package or TWD 600 standalone application fee), implementation and optional catalog additions; Stage payments assumed successful. Production payments are not authorized for simulation.

## Member journey

Home and My Account link to /membership/upgrade. The member chooses a qualification package using the existing versioned catalog/selection/order flow, or pays a fixed TWD 600 application fee. A paid formal-eligibility package covers the application requirement and prevents a second 600 charge. Paying the standalone fee creates no Qualification/Ball, GPV or award; a later qualification package is a separate purchase at its existing configured price. No invented discount/credit is applied to later packages.

Payment enters FORMAL_PENDING. The member completes the existing encrypted natural-person formal application, contract consent, identity/bank documents and submits. Submission requires authenticated ownership, paid fee or paid formal-eligibility package, and required present files. Pending malware scans can await review, but do not become CLEAN. Existing admin review/approval retains identity, spouse, cross-line, document scan and formal operating-unit gates. Approval alone changes FORMAL_MEMBER. Package checkout creates only the existing draft Qualification and canonical payment setup; it does not grant approval or placement.

## Stage payment boundary

Simulation requires UCELL_ENVIRONMENT=STAGE, STAGE_PAYMENT_MODE=ASSUME_PAID and the exact Stage PostgreSQL host/database. An isolated localhost ucell_jest database is allowed only under NODE_ENV=test. Production/simulation flag alone is insufficient. Server fixes the fee and uses stored package amounts; caller cannot submit price or payment status. Existing canonical package payment writer preserves sponsor/setup evidence. Fee payment is atomic with order/payment/audit/membership-state history and protected by per-person lock plus idempotency; retries return the same order.

Fee is the additive FORMAL_MEMBERSHIP_FEE order purpose; PostgreSQL constraints require a Person purchaser, no Qualification, TWD 600 gross/net and zero discount. It emits no retail/referral/SALE_CONFIRMED economic event. Existing retail/qualification order constraints retain their shape. Enum introduction and order-shape use are separate forward migrations so the new enum value is committed before use.

## Acceptance and release constraints

Real DB tests cover one fee/no Ball/no GPV, retry deduplication, Production denial, owned package canonical setup, BOLA denial, no second fee, paid/document submission checks and no automatic scan/approval. Member tests cover routes, fee action, paid package fee suppression and Production simulation disabled.

Stage requires forward migration, explicit simulation configuration, existing sellable package inspection, formal contract availability and private KYC/provider readiness. Any Stage-only placeholder/catalog seed must remain labeled and excluded from Production. Actual KYC scanner/storage readiness is distinct from payment simulation; never fake scan clearance or approve a user on their behalf. Approved company formal contract/privacy documents are still required before Production.

## Stage configuration evidence

The original governed version-1 prices/quantities are preserved in separately labeled Stage test versions: STARTER TWD 14,400 / 3 items, ELITE TWD 43,200 / 9 items, LEADER TWD 72,000 / 15 items. The synthetic selectable product has zero GPV and is explicitly not a real sale product. The seed preserves any already active catalog, uses canonical version approval/scheduling/activation, records the user's explicit test-catalog authority separately from the executor and creates an audit event. These versions and the user-authorized blank formal contract expire at 2026-10-10T00:00:00Z. Production requires approved real catalog/product configuration and real formal contract/privacy documents; Stage placeholders and test-product economic configuration are not Production approval.

Private storage `ucellst5mafbbsq33mgu/kyc-stage-private` has no public access. The existing Stage workload identity receives Blob Data Contributor only at that container scope. A synthetic non-personal test blob was written and read successfully through the actual application's managed-identity storage service; no document rows or CLEAN scan results were fabricated. Trusted malware scanning remains pending, and formal approval continues to require scan clearance and valid admin reviewer identity. Payment simulation does not waive these gates.

OpenAPI closure update: the recorded owner approval and selective pre-GA baseline promotion resolve the twelve previously incompatible changes. Source f70c3cf66b32db2e52db27d282311988e8ca6379 passed governance run 37089691305, RC CI 37089691300 (208 API suites / 1449 tests) and Member checks 37089691400. Original findings remain retained in governance/swaggerhub/evidence/formal-enrollment-openapi-breaking-diff-20261003.json, with approval and promotion records alongside them. No gate severity or security control was weakened. Stage preview, connected UAT, main merge and Production release remain separate decisions.
