# Carry convergence matrix

| Obligation | Status | Evidence / next action |
|---|---|---|
| Historical carry-in | PASS | Period replay consumes sealed carry evidence |
| Carry-out feeds next period | PASS | DB Golden asserts corrected continuation |
| Period-wide K1/K2 | PASS | Every sealed Binary/Matching entitlement is included per period |
| Convergence detection | PASS | Carry and award boundary compared with original sealed snapshot |
| `maxWeeks` guard | PASS | `REPLAY_INCOMPLETE`; checkpoint only, zero monetary posting |
| Resume | PASS | Same ReplayRun resumes and immutable period evidence is verified |
| Cross-ball isolation | PASS | Carry remains Qualification scoped |
