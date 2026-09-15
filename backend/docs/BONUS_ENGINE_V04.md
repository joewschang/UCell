# Bonus Engine Core v0.4.0

## Implemented engines

### 1. Referral G1
Source: GPV_CREATED event.
Sponsor tree G1.
Recipient must be Active at source event time.
Rate by G1 own plan:
- STARTER 15%
- ELITE 20%
- LEADER 25%

### 2. Referral Equalization
Base:
the G1 referral bonus theory created by the SAME source GPV event.

If G1 is inactive:
- G1 referral theory = 0
- Equalization base = 0
- no equalization for that source

Recipients:
- Sponsor Tree G2+
- each generation independently checks Active
- each recipient uses own plan + own effective-direct count
- ineligible intermediate generations do not block higher generations

Filed rates preserved exactly:
STARTER:
- G2 10
- G3 10
- G4 10

ELITE:
- G2 20
- G3 10
- G4 10
- G5 5
- G6 5

LEADER:
- G2 20
- G3 15
- G4 10
- G5 10
- G6 10
- G7 5

Referral + Equalization:
- same 42% Referral Pool
- K0 = min(1, pool / total theory)

### 3. Binary
Weekly settlement API takes explicit periodStart/periodEnd.
For each Qualification:
- read prior carry
- calculate left subtree period GPV
- calculate right subtree period GPV
- available = carry in + period GPV
- pair raw = min(left,right)
- paired PV is capped by own plan weekly cap
- theory = paired PV x 12%
- paired amount deducted from both sides
- remaining side retained as carry out
- Active First at period end
- pool 36%
- K1

### 4. Matching
Matching cannot run until same period Binary K1 is FINALIZED.
Source:
`Binary Bonus payableAmount` after K1.

Trace:
Sponsor Tree G1-G5.

Rate:
- G1 15%
- G2 10%
- G3 5%
- G4 5%
- G5 5%

Unlock:
- 0 direct: none
- 1: G1-G2
- 2: G1-G3
- 3: G1-G4
- 4+: G1-G5

Pool:
15% GPV
K2 = min(1,pool/total theory)

### 5. 45-day lifecycle
Award facts are immutable.
Lifecycle is separate:
CALCULATED → PENDING_45D → EFFECTIVE

Future:
EFFECTIVE → PAYABLE → PAID
or
REVERSED / CLAWBACK

## Important temporary engineering projection
`rules.runtime_rule_parameter` is a runtime execution projection for this vertical slice.
Production convergence must map it to the already-designed canonical hierarchy:

Rule Set
→ Rule Group
→ Rule Definition
→ Rule Version
→ Parameter Set
→ Parameter Value
→ Scope / Effective Period

Do not turn `runtime_rule_parameter` into the final single generic settings table.
