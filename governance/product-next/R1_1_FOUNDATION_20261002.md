# R1.1 foundation checkpoint — 2026-10-02

## Authority and scope

The Product Owner explicitly resumed R1.1 in the current conversation (`請繼續開發R1.1`). This supersedes the earlier pause for development only; it does not constitute Production promotion or closure of R1.0B gates.

Baseline: main `6c4878acd8bb406ad88744cc477f36910f92da6f`.
Related backlog: Geo issues #5–#11. Concurrent identity/KYC work on #18 / #19 remains separate.

## Implemented foundation

- GPV-only metric vocabulary; integer decimal arithmetic at four decimal places.
- Pure aggregation of historical Binary descendant facts: root exclusion, fixed firstSide, distinct Member holders, Company exclusion from member Active denominator, unknown Active as unavailable, explicit unlocated bucket, CITY/DISTRICT drilldown.
- Sources are signed net GPV facts, once per source; duplicate source IDs fail closed. No propagated ancestor totals, no settlement calculator, no monetary ledger mutations.
- Injected versioned Taiwan administrative catalog normalization, NFKC/台 aliases, keyed address HMAC, partial/failed/overseas status.
- Additive administrative area/profile/history schema. Historical normalization events are append-only; residential address, phone, email and exact coordinates are absent.
- Internal GeoProfileService persists source events idempotently, serializes same-person writers, retains out-of-order historical events without overwriting a newer projection, and reads asOf/knowledgeCutoff history.
- Qualification inactivity evaluator implementing approved Option A independently per Ball, 10/11-month warnings, 12-month recovery eligibility, Active reset, missing/unknown/unfinalized evidence blocking, and replay inputs.

## Approved inactivity Overlay A

Each Qualification counts consecutive calendar months in Asia/Taipei independently. Active in one Qualification never resets another Qualification. Twelve consecutive finalized inactive months make only that Qualification eligible for company recovery. Sponsor/Binary positions and all volume, Carry, Award and ownership history remain intact; other Qualifications and the Person contract are unaffected.

The evaluator consumes authoritative revised monthly Active evidence. It does not infer Active from engagement/NASL classifications or today's cached flag. `firstCountedMonth` and Overlay `ruleVersion` are mandatory inputs: no historical effective date is invented. After the first 12-month crossing, the result records that boundary rather than letting a later month erase an earlier recovery event.

Monthly notification snapshots are **plans**, not sent notices. The caller must persist one versioned template/outbox event per Qualification/month/revision with idempotency. Recovery eligibility is **not** an ownership transfer. The recovery command must revalidate the same evidence transactionally and append Company ownership/status/audit events. Return replay must append compensating decisions if a previous recovery decision is invalidated; never silently restore ownership.

## Integration work still required

1. Import and verify a complete official Taiwan City/District catalog with deterministic version/checksum; fixture catalogs are not production seeds.
2. Wire the trusted communication-address change outbox to GeoProfileService; configure HMAC key and key version outside the DB. Current service is internal and has no public write endpoint.
3. Build bounded historical Binary/ownership/Active/GPV adapter with replay verification, root authorization and metadata. The reducer requires authorized facts; it is not a replacement for RBAC or replay evidence verification.
4. Expose authorized summary/distribution/comparison/trend/top/export APIs using the existing actual `/api/v1/admin/...` route convention and documented permissions. No Geo endpoints are enabled by this checkpoint.
5. Implement Admin map/dashboard, common filtering/export context, privacy/security and large-tree benchmarks.
6. Integrate inactivity snapshot persistence, monthly close worker, notification outbox and company-recovery state machine. Resolve first counted month, effective date and Company-held award eligibility in versioned configuration before enabling the worker.
7. Run real PostgreSQL empty/current migration deployments, full R1.0B regression, Stage and desktop/mobile UAT. This foundation must not be promoted before those gates pass.

## Migration and recovery

Migration `20261002160000_r11_geo_foundation` adds organization-only tables; it never rewrites old volumes or ownership. On deployment failure, disable Geo consumers/routes and leave the additive tables/history intact. Use a forward repair migration; never drop recorded normalization history or rewrite original events as rollback.

Validation evidence is recorded in `R1_1_FOUNDATION_VALIDATION_20261002.json`. No Stage or Production deployment occurs in this checkpoint.
