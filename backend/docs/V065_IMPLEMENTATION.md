# UCell R1.0B FROZEN — Backend v0.6.5

## Focus
This slice starts the validation/convergence phase rather than adding new compensation rules.

## Completed
- AppModule now explicitly wires Adjustment, Auth and Settlement modules.
- Global Pool awards are adapted into the same Payable Ledger used by BonusAward and RPV awards.
- Dedicated GLOBAL award type added for payable classification.
- Added pure R1.0B Golden invariant calculator/tests independent of database state.
- Added a static repository validator for core module/schema invariants.
- Kept Partial Recovery outstanding-balance model from v0.6.4.

## Important
No economic parameter of R1.0B was changed.
The next hard gate is real Prisma validate/generate + TypeScript build + PostgreSQL migration smoke.
