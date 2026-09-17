# B1 schema / API delta proposal

## Core review revision (integration base d5bcfb6)

- QC uses a backend-loaded `QcPolicySnapshot` (`policyId`, `version`, non-empty `requiredChecks`). Evidence must match both policy ID and version. LABEL can be absent from an approved pre-label policy and required by a later policy. B1 defines no default sequencing policy. Missing required checks or mismatched policy fail closed; UI input is not an authoritative policy source.
- Core port is `postReceivedRmaAtCanonicalBoundary(ReceivedRmaPostingInput, context)`. Input requires `status: RECEIVED`, `receivedEvidenceRef`, `coreApprovedPostingRef` and `approvedAllocationRef`. Output explicitly carries `status: POSTED`. Core must validate receipt/posting/allocation references transactionally before creating POSTED evidence. APPROVED alone never triggers recognition reversal; no ReturnService implementation is included.
- Replace bare existingOperationHash input with `PersistedPaymentOperationClaim`. A COMMITTED claim contains its business effect identity/hash plus committed effect, payment-state evidence and outbox-intent references. INCOMPLETE claims or missing references fail closed before either NOOP path. Wrong claim identity/hash is a conflict.
- The Core persistence loader must verify referenced records exist, belong to the same committed transaction/operation and match authoritative binding. Nonempty references in a pure helper are not database proof. A stored delivery without a complete claim, or a claim without its committed state/effect/outbox, must enter integrity recovery rather than being treated as successful idempotency.
- The outbox reference proves committed intent, not external provider success or completed Core recognition. Actual downstream receipt/reconciliation remains an independent retryable workflow. No DDL or new monetary event is authorized by this revision.

These amendments supersede the initial bare-hash claim and `postApprovedRma` proposal wording below and in the original audit. Historical evidence remains associated with its original commit.

No schema, migrations, controllers or generated OpenAPI change in B1. The original full proposals remain at `../commerce-fulfillment-audit/SCHEMA_PROPOSAL.md`, `API_PROPOSAL.md`, `openapi.proposal.json` and `TEST_PLAN.md`; they are proposals, not installed endpoints. Their prior B1 BLOCKED status records their historical checkpoint; current ownership is in OWNERSHIP.md.

## Payment persistence additions for Schema Owner review

- Verified receipt binding: provider, connection/merchant scope, paymentId, orderId, providerTransactionRef, approved operation amount/currency, operation kind/id, verification config/version, verifiedAt, safe evidence reference. For refund amount, use Core-approved allocation, never Commerce price prorating.
- Separate unique delivery identity from immutable evidence hash and unique business effect identity. Current business effect key uses a structured hash of provider/connection/payment/operation-kind/operation-id; operation evidence hash also binds order/transaction/amount/currency/status. Provider operation-id recipe must be approved per actual provider specification; no guessed fallback for monetary effects.
- Query and callback may have distinct delivery identities but match the same operation claim. Delivery lookup MUST be scoped by provider connection and event identity. DB code must load both delivery and operation hashes and authoritative binding in one transaction.
- Store receipt/canonical evidence and operation claim, apply payment state and write accepted Core outbox intent atomically. A stored delivery without its matching operation claim is an integrity failure, not a successful replay.
- Hash matching does not replace verified ingress. Current in-process receipts cannot be restored via JSON cast. Core must implement a trusted stored-evidence rehydration/validation path before recovery wiring; the WeakSet is not a database ledger.
- Define precise operation identity handling for authorization/capture progression and distinct partial refunds. The B1 helper does not decide provider-specific identity recipes, currency scale/rounding, cumulative refund caps or monetary recognition.

Schema impact: additive proposals only, no DDL in this commit. Core must review indexes/constraints/backfill and any legacy PaymentEvent migration. New receipt APIs intentionally reject bare reference/boolean callers; existing Order routes are unchanged and are not wired to these helpers.

## Contract convergence

Existing Payment Hub remains the single PaymentProviderAdapter. Existing CAPTURED/PAID and REFUND_PENDING vocabulary is retained pending the Core/provider normalization decision; the earlier proposal's alternate vocabulary is not installed as a second payment model. No recognition rules change.

Inventory reserve input quantity follows the existing Inventory Lite integer representation (`number`); adapter implementations must validate positive safe integers through Core-owned inventory contracts. Pick/ship accounting timing and QC/label sequencing remain later operational decisions.

Logistics/Invoice/ERP interfaces are domain/provider boundaries only; no Black Cat/7-11/ECPay/BC provider is enabled. ERP NONE has no adapter/config prerequisite. CoreCommerceEvidencePort is unimplemented and proposes no new Core event names.

## OpenAPI / security status

The 44-operation OpenAPI proposal is retained for review. B1 has no new HTTP operation, so there is no mounted Commerce OpenAPI to regenerate. Shared exporter ownership remains Core. Previously identified generated-package-schema drift and auditor-mutation RBAC gaps remain open and are not claimed fixed.

Before B2 wiring, verify official Taishin signature/query/reconciliation, amount/merchant/order binding, callback raw-byte handling and safe errors; obtain only secret references. Mock verifier tests are not cryptographic/provider Mock, Sandbox/UAT or Production readiness evidence.
