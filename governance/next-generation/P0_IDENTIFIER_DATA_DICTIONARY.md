# P0 identifier data dictionary

| Field | Meaning and source of truth | Type / format | Unique / mutable | Visibility and API representation | Example |
|---|---|---|---|---|---|
| `Person.memberNo` | Person business Member Number; database allocator using Taipei time | text, `YYMM######` | Global unique; immutable | Member and authorized Admin; JSON string | `2609000001` |
| `Qualification.ballNo` | Public Ball Number; bootstrap position or immutable ordinary allocation record | text, tree-code prefix plus `X` bootstrap or minimum six-digit per-tree allocated sequence | Global unique once assigned; immutable | Member-safe and Admin; JSON string | `A000001`, `AX000001` |
| `BinaryTreeMembership.binaryPositionNo` | Binary heap topology identity | PostgreSQL bigint / application BigInt | unique by Tree; immutable | Admin string; Member safe minimal string | `4` |
| `binaryPath` | Derived human readable topology path | derived text `R[LR]*` | deterministic; never stored as authority | Admin and authorized Member safe DTO | `RLL` |
| `BinaryTree.treeCode` | Business Tree Code | text, approved tree grammar | globally unique; immutable in normal operations | Admin and where Ball context is authorized | `A` |

`personId`, `qualificationId`, and `binaryTreeId` remain UUID relational keys. They are not normal display identifiers. `qualificationNo` remains a technical sequence and is not a Ball Number.

## Ball Number V2 (2026-09-25)

`BallNoCounter.lastSequence` is the per-tree allocation high-water mark. `BallNoAllocation` records qualification, tree, sequence, allocation timestamp and rule version (`LEGACY_POSITION_V1` or `TREE_SEQUENCE_V2`). Unique `(binaryTreeId, sequenceNo)` and immutable allocation evidence prevent reuse. Historical backfill timestamps describe migration recording time, not original placement time. See [the current rule](BALL_NUMBER_SEQUENCE_V2.md).
