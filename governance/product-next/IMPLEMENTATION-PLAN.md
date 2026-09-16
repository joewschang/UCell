# Next release implementation plan

Status: EXECUTION BASELINE — separate from R1.0B frozen monetary scope.
Date: 2026-09-16

## Entry conditions

Implementation begins in additive, backward-compatible slices after each R1.0B integration checkpoint. Existing Member/Admin checkout, payment, refresh and PAID journey must remain operational. No next-release service may calculate or mutate PV, BV, RPV, EPV, bonus, carry, settlement or payout.

## Workstream 1 — Identity and consent foundation

1. Add versioned contract records and immutable consent evidence: contract id/version/hash, person, acceptedAt, channel, request/correlation evidence.
2. Extend Person profile for the Network Member fields: name, alias, gender, date of birth, mobile and email.
3. Add provider identity links for existing identity providers and Google OIDC. Provider identities authenticate Person only.
4. Add OTP challenge and verification evidence with hashed challenge/provider reference, expiry, attempt count, resend/rate limits and lockout. Never persist raw OTP.
5. Add Member registration screens and Admin read-back with field masking and authorization tests.

Acceptance: a Network Member can register only after accepting the applicable contract and satisfying the configured mobile-verification policy; repeat delivery is idempotent; no Qualification is created implicitly.

## Workstream 2 — Formal Member upgrade and KYC

1. Add FORMAL_PENDING and FORMAL_MEMBER workflow without changing Qualification identity or history.
2. Collect national ID, communication address, bank code/account/account holder and verified contact data.
3. Store ID and bankbook files in private object storage; persist metadata and hashes in the database; use short-lived authorized access only.
4. Add Admin review, approve and reject actions with reason, RBAC, masking, explicit unmask audit and append-only status evidence.
5. Gate formal-member-only Qualification creation on approved KYC evidence.

Acceptance: a Network Member can submit an upgrade, Admin can review it under least privilege, rejected/resubmitted history remains auditable, and only approval enables the formal workflow.

## Workstream 3 — Referral attribution and system assignment seam

1. Add signed referral token resolution and append-only attribution history, kept separate from Sponsor and Binary history.
2. Bind member-created share links to the selected owned Qualification; foreign Qualification requests are denied.
3. Preserve attribution through Member/LINE/Google transitions using server-validated opaque state.
4. Add a versioned SYSTEM_ASSIGNMENT interface and audit model, but keep execution fail-closed until the eligible system-ball pool, tie-break, capacity and locking policy are formally approved.
5. Do not implement the unfinished post-click product behavior until the Product Owner completes that requirement.

Acceptance: repeated or forged referral requests cannot change an established Sponsor edge; all attribution changes are traceable; system placement cannot run without an approved policy version.

## Workstream 4 — CMS and sharing

1. Add Admin CRUD and publish workflow for video and external-link content, including publishing window, audience and approval evidence.
2. Add Member listing/detail/view and share actions.
3. Generate share URLs through Backend with a signed referral token tied to the selected Qualification and content source.
4. Record append-only view/share/click analytics without copying national ID, bank or document data.

Acceptance: published content is visible to the intended audience, unpublished/expired content is denied, share links carry a server-verifiable referral token, and Frontend performs no monetary calculation.

## Workstream 5 — Cross-end and release verification

- Network registration: consent -> OTP -> profile -> Member/Admin read-back.
- Formal upgrade: additional fields -> private uploads -> review -> approval/rejection -> audit.
- Google sign-in/link collision and account-recovery paths.
- CMS publish -> Member view -> share -> referral landing -> attribution evidence.
- Qualification isolation: Ball1 and Ball2 remain separate; foreign Qualification is denied.
- Duplicate delivery, lost-response retry, concurrent request, upload failure and transaction rollback.
- BOLA/IDOR, masked PII, authorized unmask, object access expiry and audit coverage.
- Migration validate/generate/deploy on two fresh databases plus recovery evidence.

## Pending decisions that block only affected slices

- Completion of the Product Owner sentence describing what must happen after a recipient opens a shared link.
- Taiwan KYC/legal basis, retention periods and document-deletion policy.
- SMS provider and OTP expiry, resend, attempt and lockout values.
- Bank master source and account-verification method.
- Eligible system-ball pool, deterministic tie-break, capacity and concurrency-lock policy.
- Whether the existing 30-day attribution baseline is formally approved for this release.

These decisions cannot be inferred from fixtures or legacy tests.
