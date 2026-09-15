# v0.6.0 Self-Audit

## Implemented contracts
- R1.0B is explicitly FROZEN.
- Settlement adjustment tables preserve original Binary/Matching settlement history.
- Subscription cancellation is represented as a fact, not deletion.
- Qualification workflow supports UPGRADE / TRANSFER / EXIT / COMPANY_RETRANSFER with NT$600 review-fee default.
- Changes are prospective only.

## Deliberately incomplete in this slice
The exact Binary/Matching deterministic replay calculator is not approximated. It must reuse/refactor the frozen v0.4 calculators and accept original carry-in plus source PV events including reversals, then recompute Pair, Carry, K1, Binary Paid, Matching and K2.

The RPV reversal worker and full qualification workflow API/controller are the next implementation slice. This avoids inventing refund arithmetic inconsistent with the frozen制度.
