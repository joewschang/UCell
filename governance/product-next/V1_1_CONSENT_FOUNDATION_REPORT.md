# V1.1 Contract Consent Foundation — 2026-09-17

Status: IMPLEMENTED ON INTEGRATION; Production contract content/configuration not seeded.

This additive slice implements the first V1.1 Identity/Compliance foundation from the approved next-release engineering contract. It does not create a Qualification and does not read or mutate PV, BV, RPV, EPV, bonus, carry, settlement or payout.

## Delivered

- Versioned `ContractDocumentVersion` with type/version uniqueness, content hash, audience, effective window and approval reference.
- Append-only `ConsentEvidence` bound to Person, exact contract version and content-hash snapshot.
- Database triggers reject update/delete of both contract versions and consent evidence.
- `GET /api/v1/member/contracts/required` supports authenticated Person-scoped members, including members with zero Qualifications.
- `POST /api/v1/member/contracts/:versionId/consent` requires explicit `accepted: true`, a bounded channel and `Idempotency-Key`.
- Consent, audit and `CONTRACT_CONSENTED` outbox evidence commit in one Serializable idempotent transaction.
- `GOOGLE` is added as an identity-provider enum seam only; Google exchange/linking is not implemented or claimed.

## Verification

- Prisma validate and forward-only migrate deploy: PASS.
- Fresh isolated database from zero with 27 migrations: PASS.
- Member Identity Golden: 290 HTTP/DB assertions PASS, including exact version/hash read-back, lost-response retry, one consent row, one outbox event and DB rejection of mutations.
- Backend API: 17 suites, 185 PASS, 3 Pending Decision TODO.
- Admin: 22 PASS; Member: 116 PASS.
- Backend, Worker, Admin and Member builds: PASS.
- Static, schema, migration, source, OpenAPI and security-policy preflights: PASS.

No real participation contract text is introduced. Production remains blocked until the approved contract/privacy notice versions, formal LINE/Entra credentials, Security E2E and UAT are available. OTP, registration creation, KYC documents and Google OIDC flows remain later slices.

Two Golden attempts failed during development and were corrected: the existing Qualification context guard initially rejected Person-scoped contract routes, and the first consent response leaked the internal idempotency envelope. The final implementation permits contract routes without a Qualification while retaining member authentication and returns a stable response with an explicit replay marker.
