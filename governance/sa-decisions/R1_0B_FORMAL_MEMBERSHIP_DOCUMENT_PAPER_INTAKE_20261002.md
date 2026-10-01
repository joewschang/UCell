# UCell R1.0B Formal Membership Document and Paper Intake Decision — 2026-10-02

Status: PRODUCT OWNER APPROVED
Scope: R1.0B Formal Membership / KYC / Admin Intake
Issue: #18
Related decision: R1_0B_FORMAL_MEMBERSHIP_PARTY_SPOUSE_CONTROL_20261002.md

## 1. Online natural-person formal application

A natural person may apply to become a formal member through the Member Web system.

Before the application may be submitted for review, the applicant must provide all required identity/payout evidence:

1. identity document front image;
2. identity document back image;
3. bankbook cover / bank-account ownership image.

Saving a draft may occur before all documents are present, but submission/review must fail closed until the required evidence gate passes.

## 2. KYC document storage boundary

KYC document bytes must not be stored in ordinary application JSON, relational text fields, logs, analytics, outbox payloads, or public URLs.

The system shall use private object storage with:
- private-by-default access;
- short-lived signed upload/download URLs;
- application/person binding;
- MIME and file-size validation;
- SHA-256 content integrity;
- malware-scan state;
- immutable upload metadata;
- audited reviewer access.

A document is review-eligible only when its state is PRESENT and malware-scan status is CLEAN.

## 3. Required Web document set

For INDIVIDUAL + MEMBER_WEB, the required document types are:

- IDENTITY_FRONT
- IDENTITY_BACK
- BANKBOOK_COVER

No online formal-member application may move to review/approval until all required document types satisfy the document gate.

## 4. Paper natural-person application

A natural person may also apply using a paper application.

Paper applications are entered into the back office by authorized Membership Operations personnel.

The system shall record:
- source channel ADMIN_PAPER;
- operator identity;
- paper application reference;
- enteredAt;
- the same authoritative applicant/spouse/payout fields used by online applications;
- KYC evidence checklist and review evidence.

The system must not claim that a document was digitally uploaded when staff only reviewed a physical paper copy.

Digitized copies may be attached later only if required by the approved document-retention policy.

## 5. Legal-entity application

LEGAL_ENTITY formal-member applications are PAPER-ONLY for the current R1.0B release.

The Member Web application shall not permit a legal entity to self-submit a formal application.

Authorized back-office staff shall create and maintain the legal-entity application from paper documentation.

Corporate review may require, according to the approved filing/application checklist:
- company registration documents;
- unified business / registration number evidence;
- primary operating representative identity documents;
- representative spouse information when applicable;
- corporate bank/payout evidence;
- tax / registration documents;
- other approved compliance documents.

## 6. Source channel

Formal applications shall distinguish:
- MEMBER_WEB
- ADMIN_PAPER

Applicant type and source channel are separate dimensions.

Allowed current combinations:
- INDIVIDUAL + MEMBER_WEB
- INDIVIDUAL + ADMIN_PAPER
- LEGAL_ENTITY + ADMIN_PAPER

Disallowed:
- LEGAL_ENTITY + MEMBER_WEB

Any attempt to create or submit a LEGAL_ENTITY application through Member Web shall fail closed.

## 7. Paper evidence checklist

Paper applications use explicit evidence-review states rather than fabricated upload records.

Minimum natural-person checklist:
- identity front reviewed;
- identity back reviewed;
- bankbook cover reviewed.

Corporate checklist is versioned separately and must be satisfied before approval.

Each checklist decision records reviewer, timestamp, result and source reference.

## 8. Approval gates

No formal approval may proceed unless all applicable gates pass:

- contract consent / signed agreement evidence;
- required identity/payout evidence;
- spouse verification when applicable;
- cross-line review;
- applicant-type/source-channel rule;
- corporate KYC review for legal entities;
- any other filing-required review.

Saving/admin-entering an application does not create a Qualification/Ball or monetary right.

## 9. Privacy

Full document images and unrestricted document URLs are highly restricted KYC data.

Ordinary Member/Admin Tree/Analytics/exports shall not expose them.

Reviewer access shall be role-restricted and audited.

## 10. Economic boundary

This decision does not alter GPV, RPV, EPV, Referral, Binary, Matching, Global, Welfare, Reservoir, Carry, replay, settlement or award formulas.

It is a KYC/intake/approval workflow amendment only.
