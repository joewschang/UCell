# B1 Commerce contracts implementation

**B1 READY — contract-only slice implemented and locally verified; awaiting Core integration review.** Commerce/Fulfillment operational capability is not complete. No B2 provider implementation, new schema, controller, runtime module wiring or monetary change is included.

Base SHA: `4541f98f26a17de1f44cdbd4554ef9581b4f9497`.
Branch: `feature/commerce-fulfillment-b1-contracts`.
Ownership and permission receipt: [OWNERSHIP.md](OWNERSHIP.md).
Schema / API convergence and remaining bridge: [SCHEMA_API_DELTA.md](SCHEMA_API_DELTA.md).
Exact files and hashes: [evidence.json](evidence.json).
Commit SHA is provided in the task handoff; the evidence manifest references the fixed base and source hashes to avoid a self-referential commit hash.

## Resulting behavior

- The existing PaymentProviderAdapter remains the only payment adapter interface. Runtime source/provider/status validation fails closed; POS references and query references cannot independently establish PAID. Signature booleans alone are insufficient.
- A composition-root verification capability issues frozen, bound receipts after an injected trusted verifier succeeds. Incoming DTOs, copies and deserialized objects cannot masquerade as issued receipts. No actual verifier is configured in B1; tests explicitly inject mocks. Official provider verification remains B2 work.
- Decision input must agree with the receipt's payment, order, provider connection, transaction, approved amount and currency, plus canonical event source/status/hash/identity. This binding is a contract for Core to load from the DB; it is not a new Commerce monetary allocation rule.
- Delivery evidence and business operation identity are separate. Webhook and query can produce different observations but the same operation claim; repeated evidence or operation yields NOOP. Distinct partial-refund operation IDs remain distinct. Real exactly-once business effects still require Core-owned transactional unique claims and outbox wiring.
- Replays still require a trusted receipt; an existing delivery without its atomic operation claim fails closed. Unknown provider availability cannot resolve an adapter. Provider registry config is snapshotted to prevent mutation after construction.
- Canonical metadata uses a small allowlist and immutable projection. Non-finite numbers, numeric card data, unknown fields and free-form response payloads cannot enter canonical evidence. Known secret keys are only retained as fixed redaction markers. occurredAt is an immutable ISO string independent of caller Date mutation. Errors do not echo arbitrary field names or values.
- Added common, inventory, fulfillment/QC, logistics, invoice, RMA, ERP and Core boundary contracts. QC guard requires PASS plus all six checks and matching fulfillment evidence. ERP NONE needs no adapter. These interfaces do not implement reserve/scan/shipment/invoice/refund/BC workflows.

## Validation matrix

| Check | Result / scope |
|---|---|
| API build | PASS: `node node_modules/@nestjs/cli/bin/nest.js build` in backend/apps/api, final runtime sources |
| Focused contract Jest | PASS: 6 suites / 67 tests at first passing checkpoint; all included again in final full suite |
| Final isolated API Jest | PASS: 25 suites / 278 tests; full output in isolated-tests-final.log |
| Migration from zero | PASS: all 39 existing migrations deployed to a newly generated local test DB; no new DDL |
| Isolated DB cleanup | PASS: API_JEST_ISOLATED_CLEANUP_PASS |
| Existing DB assertions / replay / recovery regression | PASS within existing API test suite; this run's generated DB evidence copied to db-regression.json |
| Pure idempotency / binding / negative cases | PASS in contract tests; webhook/query operation classification, tampering, forged receipts, refund identity separation |
| New Commerce DB concurrency / last-unit race | NOT IMPLEMENTED / NOT RUN; unique claims/reservations need Schema Owner checkpoint |
| New Commerce HTTP / BOLA / IDOR / RBAC | NOT IMPLEMENTED / NOT RUN; no new route. Receipt binding negatives are not HTTP BOLA proof |
| Schema / migration / OpenAPI / security / TODO preflights | PASS; static checks do not establish complete OpenAPI/RBAC coverage |
| OpenAPI | Original 44-operation proposal retained, not mounted; generated package API drift remains open |
| 20 Commerce Golden Journeys | PLAN ONLY; see original TEST_PLAN.md. No full commerce Golden PASS claim |
| Provider Mock | NOT RUN: only mock verifier contract tests, no Taishin/ECPay/logistics adapter simulation |
| Provider Sandbox/UAT | NOT RUN |
| Production Ready | NO |
| Core / schema / Member protected diff | No changed protected files; confirmed before commit |

Verification environment: Node 24.21.0. This clone reused existing installed dependency directories through local node_modules junctions to C:\UCell\UCell; no dependency versions/lockfiles or live source were modified. API outputs and database package build artifacts were written in this clone. This is not a fresh dependency installation verification.

First full-suite attempt: 39 migrations applied successfully but tests failed because this fresh clone lacked compiled database output and worker dependency resolution. After building this clone's unchanged database package and linking the already installed worker dependencies, the suite passed. The final run after the last runtime edits again passed 25/278. A preliminary focused run also caught an incorrectly placed config snapshot assignment; it was corrected before any PASS claim.

The existing DB regression script writes a historical governance path. Its output was copied to this B1 directory, and that originally clean historical file was restored to HEAD; this commit does not replace historical evidence. Frozen earlier audit snapshots/results remain unchanged and intentionally still show their original failures/checkpoints.

## Recorded red-case disposition

| Prior finding | B1 disposition |
|---|---|
| POS/query refs alone treated as authoritative | Bare refs reject; verified receipt required. Real verifier, reconciliation SOP and trusted DB rehydration remain B2/Core gates |
| Unknown source/provider/status or config accepted | Runtime guards and negative tests added |
| NaN/Infinity, numeric PAN, secret alias | Rejected; canonical persistence projection allowlists fields |
| Date alias changes returned evidence | ISO string plus frozen event/metadata |
| Different source/correlation creates new event | Evidence may differ; correlation payload is rejected from canonical projection and business effect identity is independent |
| Hash replay used without receipt validation | Receipt verification occurs before classification; operation claim consistency also checked |
| Two partial refunds might collapse under status key | Distinct formal operation IDs produce distinct effect identities; provider identity recipe and cumulative refund rules remain Core/provider work |

Earlier audit harnesses are frozen against old commits and have not been rewritten to manufacture green results. The new repository Jest cases validate the revised contracts.

## Remaining gates

1. Core reviews the exact changed-file inventory and schema delta before merge; the live integration checkout is not modified by this task.
2. Core supplies DB-backed receipt recovery/rehydration, atomic payment/effect/outbox bridge and Return POSTED integration. This task does not create or rename Core events.
3. Official Taishin merchant specification, signature/query evidence, operation identity recipe, sandbox settings and secret references are required for B2. Injecting a mock verifier is not authorization to enable a provider.
4. Package RecognitionConfig resolution and return allocation remain fail closed and Core-owned. No PV/BV/RPV/EPV/Bonus/Carry/Settlement semantics are inferred.
5. Member/UX and Inventory Lite runtime ownership remain outside this slice. QC/label sequencing, pick/ship accounting and ERP cutover need their later approved policies.
