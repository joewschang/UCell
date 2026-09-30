# Payable materialization rule and time boundaries

Four real PostgreSQL regressions reproduced Global and RPV materialization admitting a different rule version or a source one millisecond after the requested cutoff. Global entries could additionally be labeled with the caller's rule rather than their source settlement's rule. Initial RPV fixtures were corrected to include their required recognition FK before the final before-repair run; all four final cases then failed with two Payables instead of one.

Materialization now selects Global awards through their settlement rule and periodEnd <= cutoff, and RPV awards through their own rule and occurredAt <= cutoff. Existing positive-value, Company destination, duplicate-source, maturity and Recovery boundaries are retained. No historical Payable, Award or rule is rewritten.

Validation: **5 suites / 28 tests PASS**, fresh **0→113**, **162 baseline assertions**, cleanup PASS; API build and security preflight PASS. Tests cover inclusion exactly at cutoff, exclusion one millisecond later, rule isolation and byte-for-field unchanged repeat materialization. Existing retail, connected-development, negative-flow and Golden payout tests pass.

Logs: C:/UCell/logs/payable-boundary-before-r2-20260930.log; payable-boundary-after-20260930.log; payable-boundary-build-20260930.log.

No migration or deployment. This change supports the existing generic Payout core and future governed Payable preparation jobs.
