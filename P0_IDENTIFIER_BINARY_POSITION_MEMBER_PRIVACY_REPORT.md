# P0 identifier, binary position, and member privacy closure

> Ball-number rules were amended on 2026-09-25. [Ball Number V2](governance/next-generation/BALL_NUMBER_SEQUENCE_V2.md) governs current behavior. Validation below records the historical P0 run, not V2 verification.

## Implemented boundary

- `identity.person.member_no` is globally unique, immutable, and allocated by the database with a Taipei `YYMM` month plus a six-digit atomic sequence. The allocator uses an UPSERT counter, never `COUNT(*) + 1`.
- The migration backfills legacy people with the governed cutover code `2609`, ordered by `created_at, person_id`. This is explicitly allocation evidence, not an assertion about historical enrollment dates.
- `organization.binary_tree_membership.binary_position_no` is a bigint immutable binary-heap identity. `membership.qualification.ball_no` is the immutable public Ball identifier derived from tree code and its immutable allocation record (bootstrap uses position).
- Tree creation and placement write the position, immutable placement evidence, and Ball number in the same transaction. Bootstrap positions retain `AX000001` through `AX000003`. New ordinary Balls start at `A000001` by successful allocation order, regardless of position; sequence width extends naturally beyond six digits. Legacy identifiers remain unchanged.
- Member sponsor/referral and new bounded tree reads serialize Ball numbers only. Bootstrap Company positions #1–#3 are removed before the response is constructed. Anonymous nodes have no holder PII, owner classification, Company state, reservoir, or financial fields.
- Admin Tree placement uses the public ten-digit Member Number for the unplaced member and the public parent Ball Number. A Member Number resolves only where exactly one unplaced Member-origin qualification exists; zero and multiple matches fail closed. A parent Ball Number is resolved only inside the selected Tree. The Tree Detail read model removes technical Qualification UUIDs before rendering; it never falls back to a UUID when Ball evidence is absent.
- Tree pages use a database snapshot token bound to member, tree, and time context. A subsequent cursor or permitted child expansion without its snapshot is rejected. Member traversal is additionally limited to the subtree rooted at a Ball owned by the authenticated member, derived from immutable binary positions; a guessed Ball number cannot enumerate a sibling branch.
- `qualification_ball_no_integrity` rejects a non-null Ball number unless it matches the authoritative Tree Code and allocation record (or bootstrap position). This complements unique and immutable constraints at the DB boundary.

## Validation

- `prisma validate`: PASS.
- Database package build and API TypeScript compile: PASS.
- `business-identifiers.e2e-spec.ts`: PASS (7 tests), including Tree A positions 1–15, deep bigint paths, position arithmetic, creation-order independence, owned-subtree authorization and raw anonymous DTO field exclusion.
- Schema, TypeScript parse, and migration preflight: PASS.
- Fresh isolated PostgreSQL migration: **PASS**. All 68 migrations applied to a disposable `ucell_jest_*` database and the runner removed it afterward.
- `business-identifiers.e2e-spec.ts` plus `binary-tree-db.e2e-spec.ts`: **PASS**, 38 tests. The suite includes real database assertions and validates bootstrap creation, immutable identifiers, tree placement, historical reads and tree concurrency boundaries.
- `p0-identifiers-db.e2e-spec.ts`: **PASS**, 3 isolated-database tests covering 32 concurrent member-number allocations, uniqueness, immutability, duplicate rejection, rejection of Ball Numbers without a binary position, Member Number uniqueness resolution, ambiguous-match rejection and Tree-scoped Ball Number resolution.
- Admin `BinaryTreesPage.test.tsx`: **PASS**, 9 tests, including canonical-node selection that sends `qualificationMemberNo` and `binaryParentBallNo`, never the legacy parent Qualification UUID.
- Admin `QualificationDetail.test.tsx`: **PASS**, 4 tests. Qualification search accepts Ball Number and Member Number; the normal list and overview render Ball Number/Member Number and do not expose a Qualification UUID.
- No Stage or production database was contacted.

## OpenAPI

`GET /api/v1/member/organization/tree` is added with business Ball input, bounded cursor, snapshot token, as-of context, and a member-safe response DTO. The generated artifact has 175 operations (baseline 174).

Admin Tree placement and preview retain the legacy UUID fields only for documented compatibility. Their public alternatives are `qualificationMemberNo` and `binaryParentBallNo`; the Admin UI uses the public alternatives exclusively.

The compatibility scanner deliberately reports the two `memberNo` response format changes. The baseline advertised a UUID because it exposed `personId`; P0 corrects that field to the required ten-digit member number. This is an intentional, reviewable contract correction rather than an unreported compatibility exception.

## Governance artifacts

- `governance/next-generation/FINAL_P0_IDENTIFIER_PRIVACY_DECISION.md` records the final Product Owner precedence and explicitly marks conflicting older wording as superseded.
- `governance/next-generation/P0_IDENTIFIER_DATA_DICTIONARY.md` defines Member Number, Ball Number, Binary Position Number, Binary Path and Tree Code without conflating them with UUID keys or the existing technical qualification sequence.

## Remaining UI audit scope

Workflow, Subscription and Analytics contributor read models still need public identifier fields before their UUID displays can be removed safely. They remain outside this completed Tree and Qualification read-model slice; no client-side identifier substitution is used where authoritative evidence is absent.
