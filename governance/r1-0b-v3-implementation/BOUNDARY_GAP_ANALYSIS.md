# R1.0B Incremental Boundary Gap Analysis

Date: 2026-09-17  
Baseline: `872c640` / Decision Register v3  
Boundary source: `R1_0B_PRODUCT_OWNER_BOUNDARY_DECISIONS_20260917.md`

This audit treats the boundary decision as an incremental clarification. Existing v3 economic formulas and historical facts remain unchanged.

| Boundary | Classification | Existing implementation/evidence | Incremental disposition | Economic impact |
|---|---|---|---|---|
| 10th/25th 00:00 Asia/Taipei cut-offs | CODE_CHANGE_REQUIRED | Calendar already supported Asia/Taipei and 10/25 slots | Added deterministic half-open settlement windows and B01/B02 boundary tests | Timing classification only |
| K0 numerator/denominator window identity | IMPLEMENTED_BUT_TEST_EVIDENCE_MISSING | Referral settlement already selected one period | Sealed one K0 window evidence object for both queries/hash; B03 | None; prevents cross-batch borrowing |
| Binary week to next 10/25 batch | CODE_CHANGE_REQUIRED | Sunday half-open week existed; batch assignment was not explicit | Added deterministic whole-week mapping; B04/B05 | Timing classification only; week remains atomic |
| Threshold transaction Active / no backfill | ALREADY_IMPLEMENTED_AND_PROVEN | ConsumptionRecognition updates one Qualification-month accumulator before Active and theory | Named B06/B07 executable evidence | None |
| Month reset / Ball isolation | ALREADY_IMPLEMENTED_AND_PROVEN | Accumulator key is Qualification + Taipei calendar month | Named B08 evidence; v3 Ball isolation retained | None |
| Active and EPV shared accumulator | ALREADY_IMPLEMENTED_AND_PROVEN | Both derive from QualificationMonthEligibleConsumptionAccumulator | Named B09 evidence | None |
| Return POSTED moves/removes historical Active | CODE_CHANGE_REQUIRED | Replay recomputed interval but removal could leave stale latest interval | Append zero-length superseding inactive evidence; B10/B11 | Delta-only adjustment/recovery; originals preserved |
| Global conservation and rounding residue | CODE_CHANGE_REQUIRED | Undistributed Global already flowed to Reservoir A | Recipient amounts deterministically round down to DB precision; residue enters Reservoir A; B12 | Conservation only; no redistribution |
| Reservoir A retry/replay exactly once | ALREADY_IMPLEMENTED_AND_PROVEN | Migrations 41/42 and unique replay action | Named B13 evidence | None |
| Reservoir A accrual-only / no outflow | IMPLEMENTED_BUT_TEST_EVIDENCE_MISSING | Only inflow/replay-adjustment persistence API exists | Added B14 structural/persistence evidence | None; no outflow introduced |
| Additional Ball via approved package | ALREADY_IMPLEMENTED_AND_PROVEN | Package checkout uses production membership qualification creation | Added B15 evidence | None |
| No system maximum Ball count | IMPLEMENTED_BUT_TEST_EVIDENCE_MISSING | No Person-count constraint exists | Added B16 multi-Ball executable evidence | None |
| Duplicate package fulfillment | ALREADY_IMPLEMENTED_AND_PROVEN | Command idempotency and purchase snapshot uniqueness | Added B17 retry evidence | None |
| Qualification exit to company holder | ALREADY_IMPLEMENTED_AND_PROVEN | QualificationWorkflowService appends holder history | Added B18/B19 evidence for stable ID/tree/carry/history | None; future ownership only |
| PICK/SHIP accounting timing | DEFERRED_BY_PRODUCT_OWNER | Payment PAID inventory reservation remains implemented | No code or inferred semantics | None; not a Stage UAT blocker |
| Stage manual Admin access | DEFERRED_BY_PRODUCT_OWNER | Stage forces `ADMIN_AUTH_BYPASS=false`; Entra is supported | Formal Stage Entra test user/credentials required; no bypass added | None |
| Stage identity cannot authenticate Production | IMPLEMENTED_BUT_TEST_EVIDENCE_MISSING | Environment guard rejects bypass outside local/staging | Added B20 executable evidence | Security only |
| Member/Admin/OpenAPI projections | ALREADY_IMPLEMENTED_AND_PROVEN | v3 Active, settlement, award and Reservoir read models exist | No contract rewrite required | None |
| Prisma/migrations | ALREADY_IMPLEMENTED_AND_PROVEN | 42 forward-only migrations | No new migration required for this increment | None |

## Boundary executable evidence

- B01-B05: shared calendar/K0 tests.
- B06-B14: Active, historical replay, Global calculation/persistence tests.
- B15-B20: package Qualification, company-held exit and environment isolation tests.
- Full v3 Mandatory Golden remains the economic invariance baseline.

## External and deferred items

- Formal Stage Entra test-user credentials are an operational prerequisite for manual Admin UAT.
- Formal LINE/LIFF credentials remain required for provider-backed Member identity UAT.
- Inventory PICK/SHIP timing is `DEFERRED_BY_PRODUCT_OWNER` and is not a business-rule failure.
- Production resources and promotion remain prohibited.