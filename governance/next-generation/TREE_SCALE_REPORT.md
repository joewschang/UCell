# Tree scale baseline

PASS: 12 combinations (10K/100K/1M × balanced/deep/skewed/wide), each in a fresh isolated database with all 67 migrations and 154 DB assertions. No Stage workload was run. No arbitrary timing threshold was used.

Each cell seeds guarded binary placement/ancestry, then one synthetic stored GPV event per Ball and four sealed Carry rows. Founding descendants and GPV are checked against independent topology arithmetic; Carry is read from sealed evidence. These are authoritative read/projection workloads, not million-award engine throughput tests. Source asOf, stable pagination and bounded child expansion are exercised. Real economic correctness uses separate Core Golden tests.

HTTP measurements use real loopback TCP, synthetic Entra sessions, production authentication guards with bypass disabled, DTO validation and the standard envelope. After warm-up, 100 samples are collected for detail, page two, expansion and Carry; monthly source has 20 samples. Percentiles are linearly interpolated. They describe this local sequential workload, not concurrent Production capacity.

## Populated source and HTTP timings

| Balls | Shape | Operation | Samples | P50 ms | P95 ms | P99 ms | Payload bytes | Max harness RSS MiB |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 10000 | balanced | projectedTreeDetailHttp | 100 | 62.43 | 76.81 | 84.04 | 8739 | 766.44 |
| 10000 | balanced | snapshotPage2Http | 100 | 15.79 | 18.10 | 20.12 | 19148 | 780.89 |
| 10000 | balanced | nodeExpansionHttp | 100 | 12.39 | 15.47 | 16.75 | 867 | 787.95 |
| 10000 | balanced | authoritativeCarryService | 100 | 10.02 | 12.02 | 12.97 | 588 | 800.93 |
| 10000 | balanced | monthlyNewBallsDbSource | 20 | 10.78 | 12.24 | 12.42 | 553 | 800.93 |
| 10000 | deep | projectedTreeDetailHttp | 100 | 60.56 | 67.05 | 77.41 | 8545 | 766.16 |
| 10000 | deep | snapshotPage2Http | 100 | 15.76 | 19.49 | 21.33 | 19297 | 780.84 |
| 10000 | deep | nodeExpansionHttp | 100 | 12.27 | 14.93 | 16.23 | 680 | 784.64 |
| 10000 | deep | authoritativeCarryService | 100 | 10.22 | 12.95 | 16.66 | 588 | 797.84 |
| 10000 | deep | monthlyNewBallsDbSource | 20 | 10.52 | 11.51 | 12.63 | 553 | 797.84 |
| 10000 | skewed | projectedTreeDetailHttp | 100 | 60.31 | 66.88 | 79.41 | 8554 | 759.45 |
| 10000 | skewed | snapshotPage2Http | 100 | 15.11 | 17.25 | 19.79 | 19248 | 773.24 |
| 10000 | skewed | nodeExpansionHttp | 100 | 12.04 | 16.43 | 20.17 | 867 | 780.11 |
| 10000 | skewed | authoritativeCarryService | 100 | 9.45 | 13.60 | 17.31 | 588 | 793.10 |
| 10000 | skewed | monthlyNewBallsDbSource | 20 | 9.83 | 11.03 | 12.35 | 553 | 793.12 |
| 10000 | wide | projectedTreeDetailHttp | 100 | 62.61 | 70.06 | 81.03 | 8735 | 761.20 |
| 10000 | wide | snapshotPage2Http | 100 | 16.09 | 18.05 | 19.76 | 19148 | 775.32 |
| 10000 | wide | nodeExpansionHttp | 100 | 12.09 | 13.73 | 16.03 | 867 | 781.96 |
| 10000 | wide | authoritativeCarryService | 100 | 9.65 | 10.59 | 12.24 | 588 | 788.91 |
| 10000 | wide | monthlyNewBallsDbSource | 20 | 10.33 | 18.55 | 22.39 | 553 | 795.21 |
| 100000 | balanced | projectedTreeDetailHttp | 100 | 74.62 | 81.37 | 84.42 | 8768 | 757.43 |
| 100000 | balanced | snapshotPage2Http | 100 | 22.72 | 26.57 | 29.59 | 19149 | 769.48 |
| 100000 | balanced | nodeExpansionHttp | 100 | 14.11 | 16.66 | 19.51 | 867 | 776.18 |
| 100000 | balanced | authoritativeCarryService | 100 | 8.89 | 14.66 | 17.54 | 588 | 783.19 |
| 100000 | balanced | monthlyNewBallsDbSource | 20 | 46.58 | 54.16 | 54.96 | 556 | 783.19 |
| 100000 | deep | projectedTreeDetailHttp | 100 | 72.61 | 81.58 | 94.38 | 8553 | 784.73 |
| 100000 | deep | snapshotPage2Http | 100 | 22.09 | 24.09 | 30.02 | 19296 | 785.63 |
| 100000 | deep | nodeExpansionHttp | 100 | 13.84 | 16.36 | 17.94 | 680 | 786.35 |
| 100000 | deep | authoritativeCarryService | 100 | 8.87 | 9.99 | 11.38 | 588 | 784.83 |
| 100000 | deep | monthlyNewBallsDbSource | 20 | 47.34 | 55.40 | 58.39 | 556 | 784.83 |
| 100000 | skewed | projectedTreeDetailHttp | 100 | 74.28 | 82.58 | 84.89 | 8562 | 760.18 |
| 100000 | skewed | snapshotPage2Http | 100 | 22.69 | 27.80 | 29.57 | 19249 | 772.14 |
| 100000 | skewed | nodeExpansionHttp | 100 | 13.88 | 19.38 | 24.24 | 867 | 786.57 |
| 100000 | skewed | authoritativeCarryService | 100 | 8.94 | 10.12 | 10.79 | 588 | 786.61 |
| 100000 | skewed | monthlyNewBallsDbSource | 20 | 45.76 | 48.90 | 51.26 | 556 | 786.61 |
| 100000 | wide | projectedTreeDetailHttp | 100 | 73.96 | 85.03 | 88.43 | 8764 | 1255.44 |
| 100000 | wide | snapshotPage2Http | 100 | 23.17 | 25.63 | 28.55 | 19147 | 1261.20 |
| 100000 | wide | nodeExpansionHttp | 100 | 14.23 | 17.18 | 22.61 | 867 | 1275.77 |
| 100000 | wide | authoritativeCarryService | 100 | 8.88 | 10.14 | 11.09 | 588 | 1283.29 |
| 100000 | wide | monthlyNewBallsDbSource | 20 | 46.56 | 50.06 | 53.34 | 556 | 1283.30 |
| 1000000 | balanced | projectedTreeDetailHttp | 100 | 240.25 | 265.33 | 275.06 | 8818 | 719.51 |
| 1000000 | balanced | snapshotPage2Http | 100 | 58.02 | 69.19 | 72.80 | 19150 | 729.70 |
| 1000000 | balanced | nodeExpansionHttp | 100 | 113.47 | 133.45 | 157.55 | 867 | 730.13 |
| 1000000 | balanced | authoritativeCarryService | 100 | 8.87 | 9.63 | 12.09 | 588 | 754.57 |
| 1000000 | balanced | monthlyNewBallsDbSource | 20 | 483.04 | 530.26 | 560.67 | 559 | 754.57 |
| 1000000 | deep | projectedTreeDetailHttp | 100 | 250.33 | 286.30 | 365.27 | 8561 | 1239.55 |
| 1000000 | deep | snapshotPage2Http | 100 | 59.25 | 76.82 | 91.07 | 19296 | 1257.91 |
| 1000000 | deep | nodeExpansionHttp | 100 | 114.73 | 133.69 | 153.38 | 680 | 1275.96 |
| 1000000 | deep | authoritativeCarryService | 100 | 9.46 | 14.73 | 17.29 | 588 | 1283.05 |
| 1000000 | deep | monthlyNewBallsDbSource | 20 | 493.57 | 576.47 | 579.06 | 559 | 1282.66 |
| 1000000 | skewed | projectedTreeDetailHttp | 100 | 241.56 | 266.49 | 270.71 | 8570 | 717.70 |
| 1000000 | skewed | snapshotPage2Http | 100 | 58.54 | 72.66 | 77.00 | 19251 | 730.61 |
| 1000000 | skewed | nodeExpansionHttp | 100 | 118.47 | 137.01 | 147.65 | 867 | 730.74 |
| 1000000 | skewed | authoritativeCarryService | 100 | 8.97 | 12.30 | 13.75 | 588 | 755.62 |
| 1000000 | skewed | monthlyNewBallsDbSource | 20 | 466.43 | 512.96 | 515.67 | 559 | 755.62 |
| 1000000 | wide | projectedTreeDetailHttp | 100 | 244.71 | 275.05 | 294.44 | 8817 | 1233.80 |
| 1000000 | wide | snapshotPage2Http | 100 | 57.63 | 69.91 | 73.00 | 19149 | 1251.50 |
| 1000000 | wide | nodeExpansionHttp | 100 | 115.11 | 135.14 | 139.94 | 867 | 1271.92 |
| 1000000 | wide | authoritativeCarryService | 100 | 9.22 | 15.07 | 16.35 | 588 | 1278.84 |
| 1000000 | wide | monthlyNewBallsDbSource | 20 | 467.47 | 512.36 | 514.59 | 559 | 1278.91 |

## Rebuild and SQL evidence

| Balls | Shape | Bounded ancestry rows | Max depth | Populated rebuild ms (one run) | GPV EXPLAIN execution ms | Leaf rows visited (rows × loops + filtered) | Scan/index choice |
|---:|---|---:|---:|---:|---:|---:|---|
| 10000 | balanced | 39989 | 13 | 361.94 | 3.43 | 13855 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 10000 | deep | 39989 | 9995 | 353.15 | 4.72 | 19993 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 10000 | skewed | 39989 | 4999 | 386.31 | 5.39 | 19993 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 10000 | wide | 39989 | 13 | 379.71 | 3.00 | 12499 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 100000 | balanced | 399989 | 16 | 2874.04 | 23.01 | 132766 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 100000 | deep | 399989 | 99995 | 2989.93 | 38.61 | 199992 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 100000 | skewed | 399989 | 49999 | 3107.53 | 43.07 | 199992 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 100000 | wide | 399989 | 16 | 2927.12 | 22.80 | 125000 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 1000000 | balanced | 3999989 | 19 | 36030.47 | 189.70 | 1262142 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 1000000 | deep | 3999989 | 999995 | 34553.97 | 377.42 | 1999992 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 1000000 | skewed | 3999989 | 499999 | 34302.53 | 422.32 | 1999992 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |
| 1000000 | wide | 3999989 | 19 | 38019.24 | 215.74 | 1249998 | Seq Scan pv_ledger; binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx |

The SQL table reports measured plan rows/loops, not a claim of unique physical disk rows. Full EXPLAIN ANALYZE BUFFERS JSON includes cache blocks, filters, index use and PostgreSQL plan memory where emitted. Background scans may choose a sequential scan for most of a table; forcing an index is not a success criterion. Rebuild and EXPLAIN are single observations, so no invented P95/P99 is assigned to them.

## Topology-only Tree summary baseline

| Balls | Shape | Detail P50/P95/P99 ms | Page two P50/P95/P99 ms | Expansion P50/P95/P99 ms |
|---:|---|---|---|---|
| 10000 | balanced | 361.79 / 412.82 / 457.16 | 11.26 / 16.80 / 22.99 | 9.01 / 11.87 / 12.68 |
| 10000 | deep | 368.89 / 447.70 / 468.59 | 11.53 / 17.78 / 26.48 | 9.13 / 10.27 / 11.69 |
| 10000 | skewed | 365.50 / 413.57 / 433.89 | 11.67 / 14.38 / 16.36 | 9.31 / 16.82 / 21.04 |
| 10000 | wide | 377.57 / 421.36 / 426.11 | 11.57 / 13.99 / 15.04 | 9.39 / 17.49 / 20.66 |
| 100000 | balanced | 73.94 / 83.31 / 89.78 | 19.45 / 22.35 / 24.43 | 11.87 / 12.89 / 13.67 |
| 100000 | deep | 72.68 / 82.96 / 87.57 | 19.78 / 22.60 / 25.94 | 11.58 / 12.73 / 13.75 |
| 100000 | skewed | 73.36 / 89.35 / 104.54 | 20.07 / 25.79 / 27.43 | 11.90 / 16.98 / 19.90 |
| 100000 | wide | 76.10 / 84.24 / 92.45 | 20.35 / 28.65 / 42.99 | 12.25 / 14.64 / 16.04 |
| 1000000 | balanced | 242.88 / 277.77 / 287.10 | 53.83 / 65.23 / 68.38 | 111.99 / 136.28 / 141.52 |
| 1000000 | deep | 246.07 / 281.53 / 303.44 | 54.01 / 64.13 / 70.54 | 109.17 / 124.56 / 135.55 |
| 1000000 | skewed | 245.55 / 269.96 / 275.45 | 51.44 / 61.85 / 64.23 | 103.73 / 115.41 / 119.35 |
| 1000000 | wide | 247.03 / 273.06 / 285.23 | 51.18 / 59.65 / 62.27 | 108.49 / 120.62 / 136.49 |

## Changes justified by the baseline

- Original deep-tree full closure grew quadratically. Canonical bounded ancestry stores approximately four rows per Ball; 1M deep-tree ancestry is 3,999,989 rows rather than all ancestor pairs. Non-leaf cycle validation remains; new-leaf insertion uses a safe fast path.
- Full synchronous 1M detail previously took approximately 11.9 seconds at P95. Large membership (>10K) or GPV-source (>2,000) workloads now use background Founding period projection; the request reads bounded canonical slots and the published generation.
- A million-source correlated reversal lookup exposed a missing partial covering index. Migration 66 adds reversal_of_event_id/recorded_at with amount included. Actual post-fix EXPLAIN of 1M probes took 945.927 ms; before-plan estimated cost exceeded 34.7 billion. The interrupted quadratic query is not a successful timing sample.
- Snapshot node pagination retains MVCC visibility plus stable UUID cursor, including transactions begun before page one and committed afterward. A dedicated concurrent-placement test checks no duplicate/missing/drift. Parent expansion uses the same snapshot and a parent index.
- Final 10K four-shape rerun verifies the later Last Updated timestamp patch. Larger measurements are the observed matrix runs; the balanced/100K measurements predate that metadata-only follow-up and are not represented as a separate rerun.

## Environment, memory and limits

Hardware: {"cpu":"11th Gen Intel(R) Core(TM) i7-11700 @ 2.50GHz","logicalCpus":16,"hostMemoryBytes":34187874304,"node":"v24.21.0"}. PostgreSQL runs in the dedicated local Docker test service on port 55432. The 12-cell matrix ran sequentially, separately from DB regression workloads. The later 10K metadata/scope rerun overlapped lightweight CI static-check activity. Autovacuum remained enabled.
Node RSS includes Jest, TypeScript compilation, test client and server; it is not isolated production API RSS. Docker DB samples are retained in evidence/tree-scale-db-container-memory-sample.json (approximately 2 GiB in the earlier sampled workload) and evidence/tree-scale-db-memory-final-matrix.json (4.136 GiB during the final 1M wide workload); neither is a peak/per-query allocation. SQL plan memory and buffers are in the raw plans. Production load/concurrency sizing requires its own environment evidence.
Raw source artifacts: evidence/tree-scale-{size}-{shape}.json and evidence/tree-scale-{size}-{shape}-populated-http.json; reversal plan: evidence/tree-scale-pv-reversal-index-plan.json. No capacity certification or Production readiness is claimed. Stage deployment remains STOP.
