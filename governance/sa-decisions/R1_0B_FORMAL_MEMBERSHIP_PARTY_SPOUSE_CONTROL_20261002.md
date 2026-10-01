# UCell R1.0B Formal Membership Party and Spouse Control Decision — 2026-10-02

Status: PRODUCT OWNER APPROVED
Scope: R1.0B Identity / Membership / KYC / anti-cross-line control
Issue: #18

## 1. Applicant types

A formal UCell distributor/member applicant may be either:

- INDIVIDUAL — a natural person.
- LEGAL_ENTITY — a lawfully established corporation/legal entity.

A legal entity SHALL NOT be represented in the domain as a Person.

## 2. Couple operating-unit rule

During a marriage relationship, spouses are treated as one formal-distributor operating unit.

Only one spouse may independently hold formal distributor rights and the corresponding multi-level organization right.

The other spouse may remain an ordinary network member/consumer, but SHALL NOT independently obtain:
- Qualification/Ball;
- Sponsor right;
- Binary Placement right;
- independent compensation/award entitlement;
- a second formal distributor operating position through another referral line.

This restriction applies only to formal distributor rights; it does not prohibit the spouse from holding a non-distributor consumer/network-member account.

## 3. Spouse data

An INDIVIDUAL formal-member application SHALL contain marital status.

When marital status indicates a spouse, the application SHALL additionally contain:
- spouse legal name;
- spouse national ID / equivalent identity number.

When no spouse exists, spouse fields are omitted.

Spouse data is collected only for formal-membership KYC and cross-line control.

## 4. Spouse verification

Authorized membership/compliance staff SHALL verify spouse information from the approved formal-member application evidence/KYC documents.

Verification evidence SHALL record:
- verification status;
- verifiedAt;
- verifiedBy;
- application/evidence reference;
- masked display value only in normal operational UI.

Full spouse national ID must not appear in ordinary Member surfaces, Admin Tree, Analytics, exports, application metadata, outbox payloads, or logs.

## 5. Privacy-preserving matching

The system SHALL store sensitive spouse identity data in encrypted application/KYC payloads.

For deterministic equality/conflict checks, use a keyed HMAC/fingerprint of the normalized identity number. A plain SHA-256 of a national ID is not sufficient for the production conflict index because the input space is enumerable.

The HMAC key SHALL be supplied through the approved secret-management path and SHALL NOT be committed to source control.

## 6. Legal entity model

Introduce a separate LegalEntity identity model.

Minimum authoritative fields:
- registered legal name;
- unified business / company registration number;
- registered address;
- legal status;
- company registration evidence reference;
- corporate payout/bank evidence;
- tax/registration metadata required by the approved filing contract.

A LegalEntity SHALL have an effective-dated primary operating representative that references a natural-person Person.

Representative history is immutable except by closing an effective interval and appending a successor interval.

## 7. Legal entity anti-bypass rule

A LegalEntity may not be used to bypass the one-operating-unit, spouse, or cross-line restrictions.

Before a LEGAL_ENTITY obtains formal distributor rights, the system SHALL check:
- duplicate legal-entity registration number;
- primary representative's current formal distributor right;
- representative's spouse current formal distributor right;
- representative participation in another legal entity holding formal distributor rights;
- other approved controlling-person conflict rules.

A representative change does not rewrite Sponsor, Placement, Carry, award, or historical ownership evidence.

## 8. Formal application model

FormalMemberApplication SHALL identify the applicant type.

INDIVIDUAL applications are Person-owned.

LEGAL_ENTITY applications are LegalEntity-owned and reference the initiating/authorized representative Person.

Existing INDIVIDUAL formal application drafts must remain readable after migration.

Saving or submitting any formal application does not itself:
- create a Qualification/Ball;
- alter Sponsor/Placement;
- create monetary entitlement;
- change historical compensation facts.

## 9. Conflict outcomes

Cross-line checks SHALL produce explicit evidence and one of:
- CLEAR;
- MANUAL_REVIEW_REQUIRED;
- BLOCKED.

No approval workflow may silently ignore or override a BLOCKED conflict.

Any override allowed by future approved compliance policy must be explicit, reason-coded, role-restricted, and audited.

## 10. Marriage changes

Spouse relationships are effective-dated.

Marriage, divorce, correction, or new evidence SHALL append/close relationship history; it SHALL NOT rewrite historical Sponsor, Placement, Carry, settlement, award, or ownership facts.

If two existing formal distributors later become spouses, the system SHALL create a compliance conflict for manual resolution rather than automatically deleting or moving either organization position.

## 11. Economic boundary

This decision does not change R1.0B economic semantics:
- GPV / RPV / EPV;
- Referral / Equalization;
- Binary K1;
- Matching K2;
- Global / Welfare / Reservoir;
- historical replay.

It is a membership eligibility and identity-control amendment only.

## 12. Filing/document alignment

Before Production approval, the business manual, application/agreement, privacy notice, and system fields SHALL use the same applicant-type and spouse-control rules.

The prior business-manual statement that only natural persons may apply is superseded by this approved decision once the corresponding filing/document amendment is adopted.

## 13. Implementation order

1. Governance + schema foundation.
2. Encrypted spouse/application payload and identity HMAC service.
3. Individual formal-application UI fields.
4. LegalEntity + representative models and admin read model.
5. Cross-line conflict service.
6. Approval gate integration.
7. Admin review UX / evidence.
8. Filing document alignment.
9. Focused UAT.

No economic-core refactor is permitted as part of this implementation.
