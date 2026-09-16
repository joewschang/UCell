# UCell V1.1 Identity & Compliance — Detailed Specification
Status: DESIGN FREEZE CANDIDATE; implementation after current R1.0B Core Closure.
Date: 2026-09-16

## 1. Objectives
Support NETWORK_MEMBER registration, FORMAL_MEMBER upgrade, explicit contract consent, mobile OTP, LINE/Google identity linking, sensitive KYC documents, bank payout identity, delivery profile and auditable Admin review without altering R1.0B monetary rules.

## 2. Person membership state
Recommended Person-level state machine:
NETWORK_MEMBER -> FORMAL_PENDING -> FORMAL_MEMBER.
FORMAL_PENDING -> NETWORK_MEMBER on rejected/withdrawn application while retaining immutable review history. Suspension/closure is modeled orthogonally; do not overload NASL analytical state.

Qualification creation requiring formal membership checks FORMAL_MEMBER at the effective time. Person status never substitutes for Qualification Active.

## 3. Field ownership
Network profile: legal/display name policy, alias, gender, DOB, verified mobile, email.
Delivery profile: recipient name, mobile/telephone, communication/delivery address; may be completed during checkout without formal upgrade.
Formal/KYC: national ID, bank code, bank account, account holder, KYC application state, document references, verification evidence.
Provider identity: LINE/Google subject/provider metadata only; no business ownership inference.

## 4. Consent
Entities: ContractDocumentVersion, ConsentEvidence. Store contract type, version, content hash, effective window, required audience, consent timestamp, Person, channel, evidence metadata. New materially applicable version can require re-consent. Never mutate old consent.

## 5. OTP
OTPChallenge fields: challengeId, Person?/registrationSession, destination fingerprint, providerRef, createdAt, expiresAt, attemptCount, resendCount, verifiedAt?, lockedAt?, status. Never store raw OTP. Server enforces expiry, max attempts, resend cooldown and rate limits. Verification result is evidence, not authentication ownership by itself.

## 6. Authentication/linking
LINE and Google OIDC map provider issuer+subject to one Person through ProviderIdentity. Linking a new provider to an existing Person requires authenticated step-up/re-verification; prevent automatic merge by matching email/mobile alone. Provider unlink requires at least one safe remaining authentication path and audit.

## 7. Formal-member KYC workflow
DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED or REJECTED; optional NEEDS_MORE_INFO. Submission freezes an application snapshot. Review records reviewer, decision, reason codes and timestamp. Approval updates Person membership state transactionally and emits outbox/audit evidence. Rejection never deletes uploaded evidence automatically.

## 8. Documents
KycDocument metadata: applicationId, documentType(ID_FRONT/ID_BACK/BANKBOOK_COVER etc.), objectKey, checksum, mimeType, size, uploadedAt, verificationState, retentionClass. Bytes live in private object storage. Require file-size/type validation, malware/content scanning where available, encryption, private access, short-lived signed download, Admin access audit and masking.

## 9. Bank identity
BankAccountIdentity: Person, bankCode, accountNumberEncrypted/tokenized, accountNumberLast4, accountHolderName, verificationState, effectiveFrom/To. Historical payout evidence must retain the bank identity snapshot/reference used; changing bank data cannot rewrite old payout records.

## 10. Suggested APIs
POST /api/v1/registration/network
POST /api/v1/auth/otp/challenges
POST /api/v1/auth/otp/challenges/:id/verify
POST /api/v1/auth/google/exchange
POST /api/v1/member/identity/google/link
GET /api/v1/member/contracts/required
POST /api/v1/member/contracts/:versionId/consent
GET/PATCH /api/v1/member/delivery-profile
POST /api/v1/member/formal-applications
GET /api/v1/member/formal-applications/current
POST /api/v1/member/formal-applications/:id/documents
POST /api/v1/member/formal-applications/:id/submit
GET /api/v1/admin/formal-applications
GET /api/v1/admin/formal-applications/:id
POST /api/v1/admin/formal-applications/:id/review
POST /api/v1/admin/formal-applications/:id/approve
POST /api/v1/admin/formal-applications/:id/reject

All mutations require idempotency where repeat delivery is plausible and append audit/outbox evidence.

## 11. UI flows
Network registration: referral context -> contract -> basic data -> OTP -> account created -> optional Google/LINE linking.
Formal upgrade: eligibility explanation -> required contract -> formal data -> ID/bank documents -> review summary -> submit -> pending/rework/approved status.
Checkout for network member: if delivery profile incomplete, collect address+phone inline; do not force formal upgrade.
Admin: KYC queue, masked Person identity, document viewer under explicit permission, review checklist, reason codes, decision confirmation, audit trail.

## 12. Security
National ID/bank/DOB/address are sensitive. Encrypt, mask, minimize logs, prohibit AnalyticsEvent payload duplication, isolate storage, use Key Vault-backed secrets, RBAC, access audit and environment separation. No sensitive values in URLs, client telemetry or referral tokens.

## 13. Tests
OTP expiry/resend/brute-force/race; duplicate registration; provider collision/linking; consent versioning; KYC late-failure rollback; document access BOLA/IDOR; Admin RBAC; concurrent approve; bank update historical immutability; checkout delivery-profile completion; zero-Qualification network member; formal upgrade does not mutate existing Sponsor/Binary history.

## 14. Pending decisions
Taiwan KYC/retention policy, SMS provider/limits, bank master/account verification, exact required ID document sides and whether automated OCR/verification is introduced. These block only affected Production capabilities.