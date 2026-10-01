# R1.0B Filing Amendment Draft — Legal Entity Applicants and Spouse Cross-Line Control

Status: DRAFT FOR COMPLIANCE / COUNSEL REVIEW
Source decision: governance/sa-decisions/R1_0B_FORMAL_MEMBERSHIP_PARTY_SPOUSE_CONTROL_20261002.md
Issue: #18

## Business manual replacement text — applicant eligibility

Formal distributor/member applications may be submitted by an eligible natural person or a lawfully established legal entity, subject to UCell identity, contract, tax, payout and compliance review.

For a natural-person applicant, UCell verifies the applicant's legal identity and whether the applicant or spouse already holds an independent formal distributor right.

For a legal-entity applicant, UCell verifies the registered legal name, registration number, registration evidence, designated primary operating representative and applicable payout/tax information. The legal entity is a separate member identity and is not treated as the representative's natural-person identity.

A legal entity may not be used to circumvent the one-operating-unit, spouse, anti-cross-line, sponsor or placement rules.

## Business manual replacement text — spouse / one operating unit

During a marriage relationship, spouses are treated as one formal-distributor operating unit. Only one spouse may independently hold a formal distributor right and corresponding multi-level organization operating right.

The other spouse may remain an ordinary consumer/network member, but may not independently obtain another Qualification/Ball, Sponsor right, Binary Placement right or independent compensation right through another referral line.

If two existing formal distributors later become spouses, the company shall open a compliance review. The system does not automatically delete, move or rewrite either historical organization position, Carry, settlement or award.

## Application form fields — natural person

Required:
- Applicant type: INDIVIDUAL
- Legal name
- National ID / approved equivalent
- Date of birth
- Gender where required by the approved application form
- Contact / address / payout fields
- Marital/spouse declaration: Has spouse / No spouse
- If Has spouse:
  - spouse legal name
  - spouse national ID / approved equivalent

The form should state that spouse identity data is used only for formal-membership KYC, duplicate-right and cross-line control.

## Application form fields — legal entity

Required:
- Applicant type: LEGAL_ENTITY
- Registered legal name
- Unified business / company registration number
- Registered address
- Registration evidence
- Primary operating representative legal name
- Primary operating representative identity evidence
- Contact / tax / corporate payout account fields
- Representative spouse declaration and conditional spouse fields

## Privacy notice amendment

Spouse national-ID data is restricted KYC data. Full values shall not be exposed on ordinary Member screens, organization trees, analytics, exports, operational logs or ordinary Admin queues.

The system may derive a keyed cryptographic fingerprint solely for duplicate-identity and cross-line equality checks. The fingerprint is not intended to reconstruct the original identity number and the key is kept outside source control.

## System / filing consistency rule

The application form, agreement, business manual, privacy notice and system fields must all use the same applicant-type and spouse-control definitions before Production approval.

This draft does not modify R1.0B compensation formulas or historical monetary facts.
