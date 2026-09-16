# Replay matrix

| Area | Executable evidence | Remaining closure |
|---|---|---|
| K0 | Historical source and recipient snapshots; append-only deltas | Full Golden chain documentation |
| K1 | All sealed Binary recipients replayed with historical carry and immutable period evidence | PASS |
| K2 | Recomputed Binary payable feeds all sealed Matching recipients each period | PASS |
| Matching traversal | Historical Sponsor/Active/Qualification evidence; fail closed | Inactive Sponsor edge decision |
| EPV | Historical month recomputation | Expanded concurrent/cross-period cases |
| RPV | Historical Binary allocation | Expanded concurrency workload |
| Return recovery | Pending cancellation, PAID clawback/recovery, positive adjustment, request processing, immutable originals, and DB-backed Golden wrapper asserted | PASS for current implemented chain; workload expansion remains |
