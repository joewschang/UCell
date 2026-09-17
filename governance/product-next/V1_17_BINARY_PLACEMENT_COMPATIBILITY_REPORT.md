# V1.17 Binary Placement Compatibility Endpoint Report

Status: IMPLEMENTED
Date: 2026-09-17
Branch: integration/member-backend-mvp

## Result

The legacy `POST /admin/organization/binary-placement` route no longer returns a synthetic `{ accepted: true }` response. It now delegates to the canonical `QualificationPlacementService.placeByAdmin` command.

The compatibility route therefore uses the same controls as `POST /admin/qualification-placements/:id/place`:

- explicit `QUALIFICATION_PLACEMENT_OVERRIDE` or `SUPER_ADMIN` authorization;
- validated qualification, Binary parent, side and mandatory reason code;
- required Idempotency-Key;
- advisory transaction locks for Qualification and Binary slot;
- pending/setup, Sponsor authority, eligibility, occupied-slot, cycle and first/third-left checks;
- append-only placement evidence, audit event and outbox event;
- replay metadata on duplicate delivery.

`QualificationPlacementService` is now provided and exported by `OrganizationModule`, so both canonical and compatibility controllers execute one implementation rather than duplicating placement rules.

## Verification

- Organization focused Jest: 1 suite, 6 tests PASS.
- Backend API build: PASS.
- Admin build: PASS (existing bundle-size warning only).
- Isolated Backend API Jest: fresh DB, 39 migrations, 18 suites, 199 tests PASS.
- Isolated DB cleanup: PASS.
- No schema or monetary-rule change.

Production Promotion remains blocked by the existing formal gates.
