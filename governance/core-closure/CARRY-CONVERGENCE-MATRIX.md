# Carry convergence matrix

| Obligation | Status | Evidence / next action |
|---|---|---|
| Historical carry-in | PASS | Period replay consumes sealed carry evidence |
| Carry-out feeds next period | PASS | DB Golden asserts corrected continuation |
| Period-wide K1/K2 | PARTIAL | Arithmetic exists; persisted run lifecycle remains |
| Convergence detection | IN PROGRESS | Implement deterministic comparison with original carry snapshot |
| `maxWeeks` guard | IN PROGRESS | Must produce `REPLAY_INCOMPLETE` without partial monetary finalization |
| Resume | IN PROGRESS | Persist immutable period checkpoints and continue deterministically |
| Cross-ball isolation | PASS | Carry remains Qualification scoped |
