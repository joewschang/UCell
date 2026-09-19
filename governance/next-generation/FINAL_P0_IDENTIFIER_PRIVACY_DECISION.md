# Final P0 identifier and member privacy decision

**Effective date:** 2026-09-19 (Asia/Taipei)  
**Approval reference:** GitHub Issue #2, Product Owner P0 Consolidation and Train D Task Revision comments.

This decision supersedes earlier wording that exposed Company bootstrap nodes to Members, used a technical Qualification identifier as a member-facing number, or inferred visibility from Company ownership alone.

| Term | Final decision |
|---|---|
| memberNo | One immutable, globally unique `YYMM######` business number per Person. Taipei time defines the month. UUID remains the relational key. |
| ballNo | Immutable public Ball number derived only from `treeCode` and `binaryPositionNo`. Bootstrap positions 1–3 use `TreeCode + X + PAD6(position)`; all later positions use `TreeCode + PAD6(position - 3)`. |
| binaryPositionNo / path | Authoritative bigint binary-heap position and derived `R/L` path. It survives holder and Company ownership changes. |
| Bootstrap visibility | Positions 1–3 remain authoritative Company LEADER / Always Active Core and Admin nodes, but are absent from every Member DTO, search, explanation, export, notification, analytics surface, and accessibility metadata. |
| Company-held position >=4 | It remains visible when otherwise within the Member's authorized scope. Company ownership alone never hides it. Company economics and Reservoir information remain excluded. |
| Reservoir | Admin/Finance governed only. Members receive no Reservoir A/B name, value, route, effect, evidence, analytics, export, notification, or tool. |
| Member tree | Server-created bounded projection, filtered before serialization, bound to authorization, effective/as-of context, rule evidence, stable snapshot and cursor. It may describe a neutral hidden-bootstrap boundary, never a fake root. |
| PII | Direct-sponsored identity follows the approved policy. Non-direct nodes contain only safe Ball/topology facts; no holder name, member number, contact, LINE, Person ID or null placeholders for those fields. |
| UUID UX | UUIDs may remain internal route and relational keys. Normal Member and Admin operational display uses memberNo, ballNo, treeCode, binaryPositionNo and binaryPath. Technical diagnostics remain RBAC controlled. |
| Admin RBAC | Operations, Support, Finance, Audit and System roles receive only their existing authorized PII, Company-economic and Reservoir data. A Member projection is never an Admin DTO with browser-side field removal. |

The original pasted requirement is unavailable after section 101. Requirements without an Issue #2 or governance source are recorded as `SOURCE_NOT_AVAILABLE`; no missing behavior is inferred from the truncated text.
