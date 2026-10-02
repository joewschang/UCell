# UCell R1.0B Legal-Entity Qualification Ownership and Identity Document Decision — 2026-10-02

Status: PRODUCT OWNER APPROVED
Scope: R1.0B Identity / Formal Membership / Qualification Ownership
Issue: #18

## 1. Legal-entity formal operating rights

A LEGAL_ENTITY that passes formal-member approval is a full formal-member operating subject.

It may purchase approved qualification packages / Balls and may hold the same approved organization-operating rights as an eligible formal member, subject to the same Sponsor, Placement, Active, package, compliance and cross-line rules.

The system SHALL NOT proxy or falsely assign a legal-entity Ball to its representative Person.

The authoritative Qualification owner must be either:
- PERSON; or
- LEGAL_ENTITY.

The representative Person acts on behalf of the LegalEntity and is an access/authority subject, not the legal/economic Qualification owner.

## 2. Qualification ownership model

R1.0B Qualification ownership SHALL be generalized from person-only holder semantics.

Current holder identity must support exactly one of:
- currentHolderPersonId; or
- currentHolderLegalEntityId; or
- approved company/bootstrap ownership where already defined.

Effective-dated owner evidence shall remain authoritative. Existing historical Person ownership must not be rewritten.

LegalEntity representative access must be checked at request time from effective representative authority. Representative changes do not transfer the Qualification.

## 3. Nationality

Member onboarding shall collect nationality.

Use an extensible country/nationality code rather than a closed source-code enum. The preferred storage contract is ISO-style uppercase country code with validation and localized display labels handled outside the economic core.

Nationality is identity/KYC metadata and has no direct compensation effect.

## 4. Identity document terminology

Replace the business term "national ID" with "identity document number".

The selected identity-document type shall be one of:
- NATIONAL_ID
- RESIDENCE_PERMIT
- PASSPORT
- OTHER

The identity document number field accepts the identifier corresponding to the selected type.

UI labels shall use:
- Nationality
- Identity document type
- Identity document number

Chinese:
- 國籍
- 身分證明文件類型
- 身分證明號碼

## 5. Identity matching

Identity matching/fingerprinting must bind:
- nationality / issuing-country context;
- identity-document type;
- normalized identity-document number.

The production conflict fingerprint SHALL use keyed HMAC.

A passport number must not be compared as though it were a Taiwan national ID without document-type / nationality context.

## 6. Registration and formal application

NETWORK_MEMBER onboarding shall capture nationality and identity-document fields.

Formal-member application shall carry forward or confirm the same identity context and may require document-image evidence according to the approved KYC document decision.

For INDIVIDUAL + MEMBER_WEB:
- identity front/back document uploads refer to the selected identity-document type;
- passport or other one-sided document regimes may be handled only after a filing/KYC checklist version explicitly defines the required image set. Until then, the current Web document gate remains the approved front/back/bankbook set.

LEGAL_ENTITY applications remain ADMIN_PAPER for the current release.

## 7. LegalEntity KYC

A LEGAL_ENTITY itself uses:
- registered legal name;
- company/legal registration number;
- jurisdiction/country of registration;
- corporate evidence.

Its primary operating representative is a Person and therefore has nationality + identity-document type + identity-document number under the Person identity model.

## 8. Spouse terminology

Spouse KYC fields should migrate from "spouse national ID" wording to "spouse identity document type / number" when the application/filling contract is updated.

Existing stored spouse fingerprints remain historical evidence; migration must not reinterpret past values without an explicit document-type context.

## 9. Economic boundary

This decision does not change:
- GPV / RPV / EPV semantics;
- Referral / Equalization;
- Binary / Matching;
- Global / Welfare / Reservoir;
- Carry;
- replay/settlement formulas.

It changes who may authoritatively own and operate a Qualification, plus identity/KYC metadata.
