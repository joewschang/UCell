# UCell Backend Architecture Baseline

## Core flow
Person -> Qualification -> Organization -> Transaction -> Ledger -> Award

## Modules
- Identity / Person
- Membership / Qualification
- Sponsor Tree
- Binary Tree
- Rule / Parameter
- Commerce Bridge
- Subscription
- Ledger / Award
- Referral Attribution
- Audit
- Integration
- Reporting

## Non-negotiable invariants
1. Person is not Qualification.
2. Qualification is the aggregate root for organization/Active/PV/bonus.
3. No cross-ball borrowing of Active, direct count, PV, carry, bonus, subscription.
4. Sponsor Tree != Binary Tree.
5. Core history is append-only / versioned.
6. Corrections use reversal/supersede.
7. API version != Rule Version.
8. ERP owns commercial/inventory/accounting execution; UCell owns member compensation logic.
9. AI does not mutate core ledgers directly.
