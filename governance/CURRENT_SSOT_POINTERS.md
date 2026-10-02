# Current SSOT pointers

The release package is governed by the following current source hierarchy:

1. Filed documents.
2. Formally approved company documents.
3. UCell R1.0 / R1.0B FROZEN system specifications.
4. Approved SA Decision Register / Core Logic Addenda for implementation ambiguities not answered by higher-authority sources.
5. Discussion notes, posters and legacy tests/fixtures.

Current R1.0B source set includes:

- UCell R1.0B FROZEN SSOT / version governance.
- UCell R1.0B Membership & Compensation Manual.
- UCell R1.0B Master System Specification.
- UCell R1.0B MVP System Specification.
- UCell R1.0B Enterprise Domain & Data Model.
- UCell R1.0B Bonus Engine & Database Specification.
- UCell Intelligence OS R1.0B AI DSL & Skill Packs v4.0.0.

Approved implementation clarifications:

- `governance/sa-decisions/decisions.json` — Decision Register v4 (original v3 rulings preserved; 2026-10-03 approved specification amendments appended).
- `governance/sa-decisions/R1_0B_VOLUME_CLASS_CLARIFICATION_20260917.md` — PV/BV abstract volume class clarification; historical GPV remains GPV with no economic migration.
- `governance/sa-decisions/R1_0B_CORE_LOGIC_ADDENDUM_v2.md` — approved recognition, calendar, Binary evidence, Sponsor traversal, Carry, 45D and Return semantics.

Important: these SA addenda fill gaps only. They do not override a conflicting higher-authority filed/formally approved source. A discovered conflict must fail closed for the affected production path and be escalated for SSOT review.

Historical note: source documents named Backend v0.6.0 as an earlier baseline; later RC/Connected-DEV closure work may change security, operations, tests and release governance without changing R1.0B economic results unless an approved decision explicitly states otherwise.


## Approved membership and document-alignment amendments

- `governance/sa-decisions/R1_0B_PRODUCT_OWNER_BOUNDARY_DECISIONS_20260917.md` — cut-offs, Active/replay, multi-Ball and company succession.
- `governance/sa-decisions/R1_0B_FORMAL_MEMBERSHIP_DOCUMENT_PAPER_INTAKE_20261002.md` — KYC, natural-person online/paper and legal-entity paper intake.
- `governance/sa-decisions/R1_0B_FORMAL_MEMBERSHIP_PARTY_SPOUSE_CONTROL_20261002.md` — legal entity and spouse/cross-line controls.
- `governance/sa-decisions/R1_0B_LEGAL_ENTITY_QUALIFICATION_IDENTITY_DOCUMENT_20261002.md` — authoritative legal-entity Ball ownership and identity documents.
- `governance/sa-decisions/R1_0B_WEB_MEMBER_MULTI_AUTH_DECISION_20261002.md` — supersedes the LINE-only restriction in the earlier Web entry decision; enabled-provider evidence remains separate.
- `governance/sa-decisions/R1_0B_RULE_ALIGNMENT_MEMBERSHIP_LIFECYCLE_20261003.md` — approved rule alignment, NT$600 admission/formal-member separation, reservation without a Ball, per-Ball twelve consecutive inactive calendar months, prospective transition and company succession boundaries.

The 2026-10-03 amendment is approved as a specification. Business effectiveFrom is not set by the commit: contract/filing/announcement alignment, required policy parameters, implementation, UAT and normal release gates remain prerequisites. RPV A-profile applicability and higher-authority single-organization wording remain explicit alignment items, not implicitly repealed rules. Specification approval, implementation, deployment and business effectiveness must be tracked independently.

R1.0B frozen originals remain historical baselines. Product-next 72-hour/BFS placement and future package configuration remain next-release design scope unless separately activated. No deployment, production parameter activation or retrospective twelve-month count is authorized by this specification update.
