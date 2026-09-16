# Core alignment matrix

| Invariant | Current evidence | Status |
|---|---|---|
| Matching follows Sponsor Tree | Settlement and replay tests distinguish Sponsor from Binary ancestry | PASS |
| Binary pairing follows Binary Tree | Existing Binary subtree tests | PASS |
| Historical evidence only | Matching replay requires sealed Sponsor, Active, Qualification, and Parameter evidence | PASS |
| Missing history fails closed | `HISTORICAL_SNAPSHOT_MISSING`; no current fallback | PASS |
| Qualification/Ball isolation | Existing Connected DEV regressions | PASS |
| Append-only monetary mutation | Existing replay posting/recovery regressions | PASS |
| Inactive Matching Sponsor edge semantics | Awaiting skip/stop/compression decision | PENDING DECISION |
