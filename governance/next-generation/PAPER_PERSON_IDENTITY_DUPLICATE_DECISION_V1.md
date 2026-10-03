# UCell Paper Person Identity & Duplicate Prevention Decision v1

**Status:** AUTHORITATIVE / MANDATORY
**Date:** 2026-09-26 (Asia/Taipei)
**Baseline:** R1.0B / Phase 1 Reliable UCell MVP
**Scope:** Paper new-Person intake, existing-Person reuse, duplicate prevention and review.
**Decision type:** Business identity authority. This decision resolves the Paper new-Person `DECISION_REQUIRED` blocker.

## 1. Objective

Paper onboarding MUST prevent accidental creation of duplicate Person/member identities while remaining privacy-safe and fail-closed.

This decision governs identity matching only. It does NOT authorize automatic Person merge, historical identity rewrite, or arbitrary administrator override.

## 2. Deterministic Person match authority

For Paper intake, an exact normalized government-issued identity document fingerprint is the deterministic existing-Person match authority.

Approved identity fingerprint input:
- documentCountry;
- documentType;
- normalizedDocumentNo.

Date of birth is a required corroborating identity attribute where collected/required by the approved membership application, but MUST NOT replace the government-issued document fingerprint as the deterministic identity key.

Names, telephone numbers and email addresses MUST NOT individually or collectively become automatic Person identity authority.

## 3. Normalization

Identity document normalization MUST be deterministic and document-type aware.

At minimum:
- trim leading/trailing whitespace;
- normalize permitted formatting whitespace/separators only where the document type explicitly allows it;
- normalize alphabetic characters to the approved canonical case;
- validate format according to the declared documentCountry/documentType;
- reject invalid/ambiguous values rather than guessing or silently correcting them.

The system MUST NOT perform fuzzy correction of a document number.

Name normalization may use Unicode/canonical whitespace normalization only for duplicate-candidate detection, not deterministic identity matching.

Telephone/email normalization may be used only as secondary duplicate signals.

## 4. Fingerprint / cryptographic policy

Do NOT store or compare a plain SHA-256 of the identity number as the authoritative duplicate key.

Create a server-side keyed fingerprint using HMAC-SHA-256 (or a stronger approved keyed equivalent):

`HMAC(server_managed_key, canonicalIdentityInput)`

Canonical input MUST include at least documentCountry + documentType + normalizedDocumentNo with an unambiguous versioned encoding.

Requirements:
- HMAC key MUST NOT be stored in the database row or committed to Git;
- key is managed through the approved secret-management mechanism;
- store fingerprint algorithm/version metadata;
- comparisons use the fingerprint, not raw identity data where feasible;
- key rotation/recovery requires a separately controlled procedure that preserves matching continuity;
- logs/audit MUST NOT contain the raw document number or HMAC key.

Raw identity data, if legally/business-required to be retained, remains governed by the authoritative Person/identity store and its privacy/access controls; this fingerprint does not create a second unrestricted identity store.

## 5. Match outcomes

### EXACT_MATCH
Exact identity fingerprint exists and corroborating required identity attributes are not contradictory.

Action:
- reuse the existing Person;
- do not create a new Person/memberNo;
- record match evidence/audit;
- normal UI shows only minimum masked identity necessary for the operator.

### POSSIBLE_DUPLICATE
No exact fingerprint match, but approved secondary signals indicate a meaningful possible duplicate, or corroborating identity data conflicts.

Examples of secondary signals may include normalized name + date of birth, same telephone, same email, or other approved identity evidence.

Action:
- status = DUPLICATE_REVIEW_REQUIRED;
- fail closed for automatic new-Person creation;
- route to authorized manual review;
- do not automatically reuse or merge Person.

### NO_MATCH
No exact identity fingerprint and no material duplicate/conflict signal.

Action:
- new Person creation may proceed through the approved Paper onboarding transaction;
- memberNo allocation remains server-authoritative;
- record provenance and audit.

### INSUFFICIENT_OR_INVALID_IDENTITY
Required approved identity evidence is missing, invalid or ambiguous.

Action:
- fail closed;
- do not automatically create/reuse Person;
- require correction/review.

## 6. Duplicate review

Duplicate review MUST be a distinct controlled workflow.

Reviewer may determine whether the Paper applicant corresponds to an existing Person or may approve new-Person creation when evidence supports it.

Requirements:
- RBAC-protected reviewer capability;
- reason/evidence reference;
- actor and timestamp;
- traceId;
- decision audit;
- no raw sensitive identity data copied into general audit records.

Self-approval restrictions SHOULD follow the existing high-risk/dual-control pattern where applicable; Codex MUST NOT invent a new dual-control business rule if current authority does not require it.

## 7. No automatic Person merge

Phase 1 MUST NOT implement automatic Person merge.

If historical duplicate Persons are discovered:
- open a governed exception/review case;
- preserve both histories;
- do not rewrite memberNo, Ball, Sponsor, Award, Payment, LINE binding or audit history automatically;
- any future merge capability requires a separate approved decision and recovery design.

## 8. Paper Admin UX

Paper intake should present only the minimum information required for safe operator action.

EXACT_MATCH:
- indicate an existing Person was found;
- show memberNo and masked/minimized corroborating identity information;
- offer governed reuse, not new-Person creation.

POSSIBLE_DUPLICATE:
- show DUPLICATE_REVIEW_REQUIRED;
- prevent normal new-Person creation until review resolves.

NO_MATCH:
- allow approved new-Person creation path.

Internal UUIDs are not normal operator-facing business identifiers.

## 9. Audit events

At minimum create/link the following business/security audit events when implemented:
- PAPER_IDENTITY_CHECKED
- PAPER_EXISTING_PERSON_MATCHED
- PAPER_DUPLICATE_REVIEW_REQUIRED
- PAPER_DUPLICATE_REVIEW_RESOLVED
- PAPER_NEW_PERSON_CREATED

Audit stores match type, actor, safe business reference, traceId, decision/reason and evidence reference as applicable.
Audit MUST NOT store plaintext document number, secrets, HMAC key or unrestricted identity payload.

## 10. Concurrency and idempotency

The database/runtime MUST enforce duplicate prevention under concurrent Paper intake.

Two simultaneous requests for the same authoritative identity MUST NOT create two Persons/memberNos.

New-Person creation and identity fingerprint binding MUST be transactional/idempotent with an authoritative uniqueness constraint or equivalent fail-closed concurrency control.

A retry MUST return/reuse the already-created authoritative result rather than allocate another Person/memberNo.

## 11. API / DB / privacy requirements

Implementation MUST assess and update as affected:
- Definition/data dictionary;
- DB schema/migration (forward-only);
- API/OpenAPI;
- Admin Paper workflow/read model;
- Person creation service;
- privacy/masking;
- audit;
- tests/Golden/security;
- implementation/gap status.

Do not edit historical migrations.

## 12. Required tests / Golden

At minimum:
1. exact fingerprint reuses existing Person;
2. exact fingerprint never allocates a second memberNo;
3. name-only match does not auto-reuse;
4. phone-only match does not auto-reuse;
5. email-only match does not auto-reuse;
6. secondary conflict enters DUPLICATE_REVIEW_REQUIRED;
7. invalid/insufficient identity fails closed;
8. concurrent same-identity creation results in one Person;
9. retry is idempotent;
10. audit contains no raw identity document number/secret;
11. normal Admin UI exposes no internal UUID;
12. existing-Person Paper flow remains compatible;
13. Paper → Qualification Order → Payment → Pending Placement → Placement → ACTIVE remains compatible;
14. later LINE link binds to the authoritative existing/new Person and does not create another Person.

## 13. Codex authority boundary

Codex is authorized to implement this decision as part of the current autonomous G1 closure mission.

Codex MUST NOT:
- choose additional identity authority fields;
- implement fuzzy document-number matching;
- auto-merge Persons;
- expose raw identity data in logs/audit;
- modify historical migrations;
- weaken fail-closed behavior.

If a jurisdiction/document type cannot be normalized under an approved deterministic rule, mark that document type DECISION_REQUIRED while continuing all other actionable G1 work.
