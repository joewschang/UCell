# Bounded Economic Lineage acceptance

Authority: current batch §28/§34–36 and the closure executor's required acceptance matrix. This closes the listed core matrix, not an unlimited Explain expansion or whole-journey browser acceptance.

The new EPV case invokes the real recognition engine, then changes current Sponsor/Active facts and proves identical historical reads and original awards. The Retail case now continues the real Worker award through matureBonusAward, UnifiedPayable, independent review/approval, immutable export and actual per-line paid-result recording before checking order-to-Award-to-Payable-to-Payout links. Company EPV uses the existing destination writer and exact-source reader.

The HTTP source audit found raw Offering/Rule JSON exposing profile/version UUIDs. Those two line fields now return bounded business summaries and deterministic snapshot references. Arbitrary nested fields, bank detail and secrets are excluded. The immutable original snapshots remain stored unchanged.

| Required invariant | Status | Executable evidence |
| --- | --- | --- |
| ORDER_TO_GPV_LINEAGE | PASS | gpv-immediate-effects-db; order-economic-evidence-db actual GPV consumption |
| GPV_TO_REFERRAL_AWARD_LINEAGE | PASS | period-eligibility-lineage-db actual Referral settlement and exact order reader |
| GPV_TO_EQUALIZATION_LINEAGE | PASS | period-eligibility-lineage-db fixed G2/G3 and locked G4 |
| GPV_TO_BINARY_SETTLEMENT_LINEAGE | PASS | period-eligibility-lineage-db active/inactive and reduced-pool Binary |
| GPV_TO_GLOBAL_POOL_LINEAGE | PASS | period-eligibility-lineage-db Global writer, sealed recipients and Reservoir A |
| RPV_RECOGNITION_TO_UPLINE_AWARD_LINEAGE | PASS | test.repurchase-partial-return-db actual API and Worker recognition/read/replay |
| RPV_COMPANY_DESTINATION_RESERVOIR_B_LINEAGE | PASS | company-reservoir-invariant-db exact RPV destination and signed effects |
| EPV_ORDER_TO_SELF_AWARD_LINEAGE | PASS | epv-lineage-closure-db actual EPV 1680 → self 840 |
| EPV_TO_SPONSOR_UPLINE_AWARD_LINEAGE | PASS | epv-lineage-closure-db actual historical Sponsor 100.8 |
| EPV_COMPANY_DESTINATION_RESERVOIR_B_LINEAGE | PASS | company-reservoir-invariant-db parameterized EPV source and actual routeCompanyBonus |
| REFERRAL_INELIGIBLE_ZERO_ENTITLEMENT_EVIDENCE | PASS | period-eligibility-lineage-db inactive G1/G2 and locked G4; order reader zero decisions |
| RETAIL_REFERRAL_ORDER_TO_PAYOUT_LINEAGE | PASS | retail-referral-db.integration actual Worker, maturity, materialization, review, export, result and read |
| RETURN_TO_REVERSAL_RECOVERY_LINEAGE | PASS | order-economic-evidence-db; test.repurchase-partial-return-db; exact returns and recovery applications |
| REPLAY_CORRECTION_LINEAGE | PASS | order-economic-evidence-db exact action/checkpoint/posting/carry/paid correction history |
| LINEAGE_USES_HISTORICAL_SNAPSHOTS_NOT_CURRENT_STATE | PASS | epv-lineage-closure-db changed Sponsor/Active; period and retail changed-state fixtures |
| LINEAGE_IDEMPOTENT_READ | PASS | Repeated full reader equality and unchanged stored sources across the focused suites |
| LINEAGE_RBAC_BOLA | PASS | lineage-http-privacy-db authenticated four approved roles, no-auth denial, unauthorized-role denial and internal-ID rejection |
| LINEAGE_NO_NORMAL_UI_UUID_LEAK | PASS | lineage-http-privacy-db; source-edge privacy assertions; Admin whitelist rendering tests |

All eight families are represented: REFERRAL, EQUALIZATION, BINARY, MATCHING, GLOBAL, RPV, EPV, RETAIL_REFERRAL. Matching uses actual Binary→Matching settlement and sourceAward/period evidence in period-eligibility-lineage-db. GPV, historical Active/Sponsor/Binary, K0/K1/K2, Carry, Reservoir A/B, Payable/Payout, Return/Recovery/Replay, zero entitlement and zero recognition are covered by the same focused matrix. Whole-period and whole-payout amounts remain explicitly non-attributed to a single order.

Validation: **8 suites / 121 tests PASS**, fresh **0→113**, **162 baseline DB assertions**, cleanup PASS. API build, security preflight and **13 Admin lineage tests PASS**. Logs: C:/UCell/logs/lineage-acceptance-final-20260930.log, lineage-closure-build-20260930.log and lineage-admin-20260930.log. No migration or economic writer changes are part of this lineage slice.

ECONOMIC_LINEAGE_CORE = PASS. Browser acceptance remains under the dedicated §34/§35 UX gate; full batch and Stage readiness remain open.
