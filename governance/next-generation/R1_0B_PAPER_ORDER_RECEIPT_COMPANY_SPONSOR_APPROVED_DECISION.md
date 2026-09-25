# R1.0B Paper Order / Receipt / Company Sponsor Decisions — Product Owner Approval

Status: APPROVED FOR IMPLEMENTATION
Date: 2026-09-25 (Asia/Taipei)
Baseline: R1.0B ONLY

## 1. ADMIN_PAPER_ORDER purpose
ADMIN_PAPER_ORDER is an order source/channel, not a separate economic engine.
It may create RETAIL_PRODUCT orders and/or QUALIFICATION_PACKAGE orders/acquisitions using the same authoritative catalog/order/qualification flows as online.
If one paper form contains both categories, use one order only if current Order Core safely supports distinct lifecycle/economic semantics; otherwise split into linked orders under one paper intake reference.
Paper/online reuse Product snapshots, pricing authority, SponsorResolver, Payment, Placement, Award and Return/Replay. Source is provenance only.

## 2. Paper receipt evidence
Minimum evidence:
- paperReceiptReference: normalized bounded external/manual receipt reference, unique/idempotent in company/payment-channel namespace.
- receivedAt: actual company-confirmed receipt/payment time, Asia/Taipei unless source has explicit offset.
- paymentChannel: controlled enum mapped to Payment Core.
- amount: Decimal/NUMERIC, never float.
- currency: currency code; do not hard-code if Core supports currencies.
- evidenceDocumentRef: optional secure reference; never raw document/identity/bank data in logs/OpenAPI.
- enteredBy/receivedBy: authenticated operator, not client-asserted.
- confirmedBy: authenticated authorized approver.
- confirmationAt.
- optional bounded note subject to PII/secret controls.
If no approved secure document store exists, v1 stores reference/metadata only and MUST NOT invent a public file store.

## 3. Payment authority and idempotency
Paper evidence may be entered by authorized Operations/Support according to existing RBAC. A receipt causing authoritative PAYMENT_CONFIRMED / Qualification PLACEMENT_PENDING requires authorized payment approval.
Prefer existing Finance/Operations approval capability; do not create a parallel identity system.
Where existing RBAC supports dual control, paper Qualification payment requires enteredBy != confirmedBy. If current RBAC cannot express safe approval, fail closed and report RBAC_DECISION_REQUIRED rather than weaken authorization.

Idempotency identity: paperReceiptReference + paymentChannel + company/payment-account namespace, or a stricter existing Payment Core identity.
Same identity + same immutable facts returns/references the same confirmation.
Same identity + conflicting amount/currency/order/person facts => 409 CONFLICT; no second payment.

## 4. Pre-placement reversal/refund
Qualification package before Placement Commit:
- authoritative reversal/refund/cancellation closes the pending acquisition using existing Payment/Return/Replay authority;
- acquisition becomes ineligible for Placement;
- no ACTIVE Ball, binary position, Sponsor economic entitlement or payable qualification award remains;
- later placement attempt fails closed.

Retail inventory/physical fulfillment remains ERP/operations responsibility; UCell economic state follows UCell Order/Return authority.
After Placement/Activation, refund is not onboarding rollback; use existing Return → Replay → Adjustment/Recovery/Clawback.

## 5. Sponsor and Placement on paper
Paper operator may enter/propose Sponsor Code from application evidence. Sponsor always resolves through shared SponsorResolver.
Requested parent/side may be captured only as proposal/evidence if the form contains it. Actual placement remains authoritative Tree → Parent Ball → LEFT/RIGHT → Preflight → Review → Commit.
Admin acting on behalf preserves original Sponsor; performedBy, reason and audit required; Admin gains no Sponsor/economic entitlement.

## 6. Notifications
After paper Qualification payment confirmation:
- notify applicant if a safe approved channel exists;
- notify Sponsor of pending placement when an approved channel exists;
- create Operations-visible pending placement work.
After activation, notify applicant when possible.
Notification failure does not roll back Core; provider unavailable uses existing CONFIGURATION_PENDING/outbox retry semantics. No sensitive payment/identity evidence in payloads.

## 7. Company Sponsor alias policy v1
Company Sponsor alias is allowed only for explicitly authorized company-sponsored Qualification onboarding and exists to avoid exposing hidden Bootstrap #1–#3 identifiers.
- governed server-side config/registry, never member-created;
- alias unique, normalized, effective-dated, auditable, not itself a Ball Number;
- resolver maps alias to authoritative Company Sponsor policy/evidence and never returns hidden bootstrap ballNo to Member;
- Member shows neutral approved label such as UCell 公司推薦, not bootstrap identifiers/economics;
- no Reservoir, Company economics, #1–#3 identifier, holder identity or topology disclosure;
- mapping is Admin/System governed and versioned;
- target changes do not rewrite historical Sponsor Evidence; acquisition snapshots rule/config evidence;
- v1 alias is Qualification Sponsor only and is NOT automatically a Retail Referrer;
- no effective configured mapping => fail closed.
Exact alias text and target mapping are deployment configuration, not hard-coded here.

## 8. Paper Person and later LINE linking
Always search existing Person first. Existing Person reuses memberNo. New Person is created only after approved duplicate checks, with paper provenance. Paper Person may have no LINE binding.
Formal membership still requires Qualification activation after payment + Placement.
Later LINE linking uses Existing Member LINE Link and never creates a second Person/Ball or changes Sponsor/position/economics.

## 9. Audit
At minimum:
PAPER_APPLICATION_CREATED
PAPER_ORDER_CREATED
PAPER_RECEIPT_EVIDENCE_ENTERED
PAPER_PAYMENT_CONFIRMED
PAPER_PAYMENT_REVERSED
QUALIFICATION_PLACEMENT_PENDING
ADMIN_PLACEMENT_ON_BEHALF
QUALIFICATION_ACTIVATED
COMPANY_SPONSOR_ALIAS_RESOLVED
Audit actor, memberNo/order/acquisition refs, reason, evidence ref, timestamps and rule/config version; never raw tokens, full identity docs or full bank data.

## 10. Acceptance tests
- paper retail order uses same Commerce Core.
- paper qualification order uses same Package/Acquisition Core.
- mixed paper form cannot corrupt lifecycle.
- duplicate Person prevention.
- Decimal/currency validation.
- receipt idempotent replay.
- conflicting duplicate receipt => 409.
- unauthorized confirmation denied.
- dual-control where supported; otherwise fail closed.
- payment confirmed → PLACEMENT_PENDING.
- pre-placement reversal makes placement impossible.
- paper Sponsor parity with online SponsorResolver.
- proposed parent/side cannot bypass Placement.
- Admin placement does not change Sponsor.
- notification failure does not rollback Core.
- Company alias resolves without bootstrap disclosure.
- Company alias historical evidence immutable.
- Company alias cannot be Retail Referrer in v1.
- paper member later LINE-links same Person/memberNo/Balls.
- P0 privacy/Reservoir zero-disclosure unchanged.
- R1.0B Economic Golden unchanged except approved fixtures.

## 11. Gate
Forward-only migrations; reuse Core first; regenerate OpenAPI; full Backend/Admin/Member/Shared, DB Golden, R1.0B Economic Golden, Return/Replay, P0 Privacy, LINE Security and RC isolated must pass. No Stage/Production deployment without separate approval.
