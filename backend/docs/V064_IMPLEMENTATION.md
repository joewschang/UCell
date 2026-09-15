# UCell R1.0B FROZEN — Backend v0.6.4

## Completed
- Partial Recovery balance: recoveryAmount / recoveredAmount / outstandingAmount.
- Multi-batch recovery application via RecoveryApplication.
- IdentityLink and AuthSession data model.
- Server-side bearer session authentication baseline.
- LINE identity adapter boundary (external LINE token verification intentionally not faked).
- Request/correlation audit interceptor implementation.
- Deterministic R1.0B Golden Dataset definition.

## Accounting invariant
`recoveredAmount + outstandingAmount = recoveryAmount`.
Original BonusAward remains immutable.

## Next
v0.6.5 should execute real schema validation/compile correction, implement executable Golden E2E fixtures, Global Pool payable adapter, and production LINE/Entra verification.
