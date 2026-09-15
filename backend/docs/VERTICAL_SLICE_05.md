# v0.5 — Negative Flow, EPV, Global/Welfare, Payout

## Return / Reversal
Return is an event, never a delete.

Flow:
RETURN_POSTED
→ RETURN_CONFIRMED
→ GPV_REVERSAL
→ direct-source award reversal/clawback
→ Binary/Matching recalculation request

### Direct-source Referral/Equalization
These awards keep `source_event_id`, therefore the refund can identify the exact source GPV.

If latest lifecycle = PENDING_45D:
→ REVERSED

If latest lifecycle = EFFECTIVE / PAYABLE / PAID:
→ CLAWBACK
→ BonusRecoveryEvent（此表為可結清的追回狀態紀錄；原 BonusAward 與 Lifecycle Event 仍維持不可變）

### Binary / Matching
A refund can change:
- left/right volume
- Pair PV
- carry
- K1
- actual Binary Paid
- Matching theory
- K2

Therefore v0.5 does NOT rewrite closed settlement facts.
It creates:
`SettlementRecalculationRequest`

The next adjustment engine must calculate a compensating delta batch.

## Temporal qualification status
Added `qualification_status_history`.

Historical effective-direct calculations now consult temporal EFFECTIVE status rather than only current `qualification.status`.

## EPV
Only `OrderPurpose = REPURCHASE`.

Parameters:
- Base normal repurchase: 2,000
- Excess × 60% = EPV
- Self: EPV × 50%
- Sponsor Tree G1-G5: EPV × 6% each
- Active First
- no backfill

Example:
4,800 purchase
→ first 2,000 normal
→ excess 2,800
→ EPV 1,680
→ self 840
→ 5 uplines × 100.8 = 504
→ total 1,344 = 80% of EPV

## Global Pool
5% of GPV.

Ranks:
- NEW_STAR: 1.5%, weak 300k
- EXCELLENCE: 1.0%, weak 600k
- GLORY: 0.5%, weak 1m
- DIAMOND: 0.5%, weak 2m
- CROWN: 1.5%, weak 4m

Rank achievement is retained.
Monthly payout still requires:
- Active at snapshot
- actual current-month weak-side PV >= that level threshold

Passed levels are cumulative.

If a rank level has no eligible holder, its slice is carried to the next higher rank level.
If CROWN is also empty, it remains undistributed in the settlement.

## Welfare Pool
2% is accrued into a separate ledger.
No member distribution is generated because no formal allocation rule is defined in the current source-of-truth.

## Payout
EFFECTIVE awards
→ Payout Batch
→ recovery offset
→ PAYABLE
→ external payment
→ PAID

Payout batch never modifies original bonus award facts.
