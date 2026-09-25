# R1.0B Paper Order and Receipt Decision Package

Status: DECISION_REQUIRED. This package blocks only paper-order/payment implementation; it does not block the existing paper application, SponsorResolver, placement, or LINE-link slices.

## Required product decisions

1. Define whether `ADMIN_PAPER_ORDER` may create a Qualification acquisition, a retail order, or both; identify the single authoritative Core order purpose for each case.
2. Define the approved paper receipt evidence fields: external receipt reference format, received-at meaning/timezone, payment channel, amount/currency, document retention classification, and the role allowed to confirm it.
3. Define payment confirmation authority and idempotency identity. A repeated receipt reference must either return the same immutable confirmation or fail closed.
4. Define pre-placement refund handling: cancellation/reversal semantics, inventory treatment, and whether any qualification draft must be closed before a placement attempt.
5. Confirm whether a paper operator can propose Sponsor/Parent/side only, with the existing SponsorResolver and Placement preflight/commit remaining authoritative.
6. Confirm notification requirements for applicant, Sponsor and Operations after payment confirmation and placement.

## Non-negotiable implementation constraints

- The solution reuses Person, Package, Order, Payment, SponsorResolver, Placement, Return/Replay, Audit and Outbox.
- It may not create a paper-only Sponsor, Bonus, Payment, or Placement engine.
- Receipt identifiers and operator evidence are auditable; raw identity documents and bank/identity data are never placed in normal logs or OpenAPI examples.
- Company Sponsor alias remains separately blocked by a governed alias/policy decision; Bootstrap Ball identifiers remain member-hidden.

## Acceptance evidence after approval

- Duplicate Person check before creation.
- Paper and online Sponsor resolution parity.
- Receipt confirmation idempotency and RBAC/BOLA tests.
- Payment-to-placement pending, placement activation, pre-placement refund, and return/replay tests.
- OpenAPI contract, audit/outbox evidence and Admin manual-UAT steps.
