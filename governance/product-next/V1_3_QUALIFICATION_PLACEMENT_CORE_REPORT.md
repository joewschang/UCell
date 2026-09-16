# V1.3 Qualification Placement Core Report

## SSOT alignment

Implements the approved placement subset of `NEXT_RELEASE_DECISION_BATCH3_PLACEMENT_APPROVED.md` without changing frozen monetary formulas or treating referral attribution as a final Sponsor assignment.

## Delivered

- Added independent Qualification setup, Sponsor-selection, placement, overdue-escalation, and Person-referrer evidence models.
- Enforced the exact 72-hour placement deadline at the database boundary.
- Added a database unique constraint for one current Binary child per parent/side slot.
- Added Sponsor-owner pending placement reads and Serializable, idempotent placement commits.
- Placement revalidates Sponsor ownership, confirmed Sponsor edge, target eligibility, open slot, Binary cycle, and existing first/third-left Core rule.
- Added Admin placement monitor, overdue sweep/evidence, and override restricted to `SUPER_ADMIN` or `QUALIFICATION_PLACEMENT_OVERRIDE` with a mandatory reason.
- Placement creates Binary history, immutable PlacementEvidence, Qualification lifecycle history, audit, and outbox atomically.
- Placement does not set `activeFlag`; Active eligibility remains a separate Core fact.

## Intentionally blocked

- Creating Qualification setup from a purchase remains blocked until authoritative membership-package SKU/Profile mapping is approved and versioned.
- Sponsor selection/confirmation APIs and first-Ball Person referrer activation will follow on top of qualifying-purchase evidence; no client-supplied package classification is accepted.
- Production role grants, alert delivery, formal KYC completion, and production promotion remain blocked by their existing gates.

## Verification

- Backend and Worker builds: PASS.
- Prisma validate/generate: PASS.
- Fresh isolated DB: 37 forward-only migrations deployed and cleaned up.
- Qualification Placement Golden: 21 assertions PASS, including foreign-owner denial, exact 72h overdue evidence, Admin reason enforcement, idempotent retry, immutable evidence, and a real concurrent same-slot race.
- Existing Member/Admin, identity, return, membership, RPV concurrency, System Assignment, content, and formal-application DB journeys remain PASS.
- OpenAPI, schema, and migration preflights: PASS.
