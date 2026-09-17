# Branch Consolidation Record — 2026-09-17

Status: CONSOLIDATED DEVELOPMENT BASELINE
Target: `integration/member-backend-mvp`

## Disposition

| Branch | Disposition | Evidence |
|---|---|---|
| `codex/backend-phase2` | Already contained | zero unique commits relative to integration |
| `codex/backend-phase3` | Already contained | zero unique commits relative to integration |
| `rc1-recovered` | Already contained; retain stable archive | zero unique commits relative to integration |
| `feature/member-liff-mvp` | Merged by historical disposition | eight early Midnight/Premium UI commits are recorded as merged; current integration tree is retained because UX-3 Design System Freeze and Connected API implementations supersede those files |
| `main` | Already ancestor; unchanged | no merge or promotion performed |
| `rc1-production` | Archive only; excluded from product merge | contains partial one-time source archive chunks and publisher scaffolding, not current product changes |
| `rebuild/rc1-source-v1` | Archive only; excluded from product merge | reconstruction bootstrap predates the recovered/integration codebase |

The Member disposition merge uses Git's `ours` strategy intentionally. It records ancestry without replacing approved UX-3, current API contracts, security controls, package flows or product data with the older branch tree.

## Controls

- No force push.
- No merge to `main`.
- R1.0B Core monetary semantics remain unchanged.
- Archive branches remain available for audit.
- All new development continues from `integration/member-backend-mvp` until a reviewed RC candidate branch is authorized.