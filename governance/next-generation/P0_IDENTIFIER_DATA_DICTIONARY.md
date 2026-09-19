# P0 identifier data dictionary

| Field | Meaning and source of truth | Type / format | Unique / mutable | Visibility and API representation | Example |
|---|---|---|---|---|---|
| `Person.memberNo` | Person business Member Number; database allocator using Taipei time | text, `YYMM######` | Global unique; immutable | Member and authorized Admin; JSON string | `2609000001` |
| `Qualification.ballNo` | Public Ball Number; derived from authoritative tree position | text, tree-code prefix plus `X` bootstrap or minimum six-digit position code | Global unique once assigned; immutable | Member-safe and Admin; JSON string | `A000001`, `AX000001` |
| `BinaryTreeMembership.binaryPositionNo` | Binary heap topology identity | PostgreSQL bigint / application BigInt | unique by Tree; immutable | Admin string; Member safe minimal string | `4` |
| `binaryPath` | Derived human readable topology path | derived text `R[LR]*` | deterministic; never stored as authority | Admin and authorized Member safe DTO | `RLL` |
| `BinaryTree.treeCode` | Business Tree Code | text, approved tree grammar | globally unique; immutable in normal operations | Admin and where Ball context is authorized | `A` |

`personId`, `qualificationId`, and `binaryTreeId` remain UUID relational keys. They are not normal display identifiers. `qualificationNo` remains a technical sequence and is not a Ball Number.
