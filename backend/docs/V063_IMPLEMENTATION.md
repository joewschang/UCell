# UCell R1.0B FROZEN — Backend v0.6.3

## Completed
- Settlement calendar moved from prototype UTC assumptions to explicit runtime parameters.
- Default timezone seed: Asia/Taipei.
- Default week start seed: Monday (ISO 1), subject to final filed/operational confirmation before production data.
- Unified Payable Ledger introduced for BonusAward and RPV Upline Award.
- Payout is grouped by Qualification, never merged merely because one Person owns multiple Qualifications.
- Open Recovery is explicitly applied against Gross payable to derive Net payable.
- RecoveryApplication records the exact offset.
- Qualification holder authorization checks temporal ownership server-side.
- Admin RBAC guard baseline added.

## Accounting invariant
Historical Award / RPV Award / Recovery facts are immutable.
Payable and Payout are projections and settlement facts layered above them.

## Next
v0.6.4:
1. real Prisma schema validation/compile correction;
2. JWT + LINE identity adapter;
3. request/audit middleware;
4. executable Golden dataset;
5. Global Pool adapter into Payable Ledger.
