# Integrated period-control validation

Validated source target: `b43566602865f848c22b29c57ca91e5462a7a900` (Compensation Period Control), including the earlier ERP reconciliation bridge, shared settlement dispatch and funded Worker process-recovery tests.

The initial run in the active checkout overlapped changes to the Compensation Period service and test files. Hash comparisons detected those changes. That run ended with 151 suites / 1,139 tests passing and one raw-Worker-error privacy test failing. Its results are not used to certify a fixed source version. Log: `C:/UCell/logs/integrated-period-control-full-20260929.log`.

A detached checkout at `C:/UCell/worktrees/period-control-validation-b435666` freezes the target commit and preserves the active checkout's newer work. The desktop worktree tool could not create a checkout for this projectless chat (Not a git repository), so Git created this separately named checkout. It is retained for repeatable validation; it has no deployment process.

Reproduction: install backend dependencies with `pnpm --dir backend install --frozen-lockfile --ignore-scripts`, generate the Prisma client, run the recursive backend build, then run `pnpm --dir backend test:api:isolated`. All backend package builds PASS. Build log: `C:/UCell/logs/fixed-period-control-build-20260929.log`.

The fixed-source full run completed with **151 suites / 1,139 tests PASS** and one failure in `train-bc-foundation.e2e-spec.ts` (`active.rate`, `rank.distribution` or `bonus.distribution` returned `STALE` after the fixture closed its synthetic qualification). The database lifecycle applied **0→109 migrations**, passed **162 baseline assertions** and cleanup PASS. Log: `C:/UCell/logs/fixed-period-control-full-20260929.log`.

This is retained as a failed aggregate gate, not converted into PASS. The exact Train B/C foundation file subsequently passed in isolation on current HEAD: **1 suite / 7 tests PASS**, fresh **0→109**, **162 baseline assertions** and cleanup PASS. That distinguishes a suite-order/shared-state test interaction from a deterministic focused failure, but does not by itself certify the full aggregate gate or prove a production defect. No assertion was weakened and no Business/Core behavior was changed for this diagnostic.

This checkpoint covers the stated source version only. Newer Compensation Period changes in the active checkout are not covered by the fixed-source aggregate run. Admin/browser acceptance, remaining orchestration controls, Stage readiness and deployment are not certified by this API regression. Stage remains NOT READY; no feature was enabled and no deployment was performed.
