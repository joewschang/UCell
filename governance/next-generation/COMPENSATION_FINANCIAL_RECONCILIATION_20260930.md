# Compensation source and payment reconciliation

Bounded implementation evidence for §35 FER-12–15 and FER-23. Overall CR-BATCH-01 remains IN_PROGRESS; no Stage/Production deployment or whole-batch certification.

The repeatable-read control now reconciles typed Bonus/RPV/Global source awards, Company destination effects, materialized Payables, recorded Recovery applications and their related payout lines. Payout dates alone do not establish attribution. Every mature positive member source must have a matching payable; Company sources cannot become member payables. A paid payable requires its actual payout link and effective Bonus lifecycle evidence.

Financial reconciliation requires valid source/cohort/volume evidence, zero missing/unpaid payables, balanced Recovery applications and no outstanding recovery, consistent payout line/batch totals, independent Finance/Compliance approvals, a valid immutable export matching the recorded batch, complete cumulative per-line bank results (including zero-net confirmation), and no unresolved HIGH/CRITICAL period/job/payout exceptions. Acknowledging an exception does not resolve it. A date-matched legacy payout remains visible but cannot prove attribution or close a period.

Amounts distinguish the recorded Bonus/RPV theory subtotal from Global allocation. Company destination credits/adjustments and undistributed pool effects are both shown. Related payout-line amounts remain whole-line amounts: a line may pay several award periods; no unapproved per-period recovery/bank allocation is invented. The UI explicitly labels that scope and shows missing-payable/unpaid/bank-evidence counts. ERP posting remains independent.

The control response whitelists approvals and export metadata, uses hashed references, and omits raw actors, internal IDs, export contents, exception summaries and worker errors. Reads do not change economic facts or persist a hard close.

## Verification

- Fresh isolated PostgreSQL: migrations 0→117, 162 baseline assertions and cleanup PASS.
- Six suites / 70 tests PASS: financial evidence, period control unit/DB, payout result recovery, Company invariants and actual period jobs. `C:/UCell/logs/cr-batch-financial-final-tests-20260930.log`.
- Additional final financial edge checks: 2 suites / 25 tests PASS, including actual 100 recovery → zero-net payout → zero confirmation and legacy paid-without-line/effective-source protection. `C:/UCell/logs/cr-batch-financial-edge-tests-20260930.log`.
- Final cleaned unit fixture rerun PASS (15 tests); Admin focused render test PASS with explicit shared-line labels; Admin typecheck/build PASS.
- Backend/API/Worker build, regenerated OpenAPI, OpenAPI preflight and security policy preflight PASS. Logs use `cr-batch-financial-*20260930.log` under `C:/UCell/logs`.

Real DB cases execute the shared payable materializer, payout builder, independent approvals, immutable export and cumulative bank-result workflow. Fault-injection cases substitute legacy/corrupt read evidence without disabling database guards. Financial-helper cohort fixtures establish only the supplied financial source scope; they do not claim to certify orchestrator or recognition behavior, which have separate real-engine suites.

Remaining §35 work includes full typed RPV/Global recovery acceptance mapping, detailed period-to-source drilldown, four-stream ERP/accounting projection, Operations integration and actual browser journeys. Exact ERP account mapping and live EZTooL/bank-specific interfaces remain separate external dependencies.
