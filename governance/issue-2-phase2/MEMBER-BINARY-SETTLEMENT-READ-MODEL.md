# Member Binary Settlement Read Model

## Scope

`GET /api/v1/member/organization/binary` accepts an optional `settlementBatchId`.
When supplied, it is an exact immutable scope: the Backend reads left/right period
GPV and carry only from the sealed `BINARY_K1` historical replay snapshot for that
finalized settlement batch and the authenticated Person's selected Qualification.

The read fails closed when the batch is not finalized, the sealed snapshot is
missing or corrupt, the Qualification has no unique carry recipient evidence, or
any disclosed metric is negative, non-finite, or outside JavaScript's safe numeric
range. It never reconstructs historical values from the current Binary Tree,
current Active state, or current parameters.

## Member UI availability

There is currently no authoritative Member API that lists the finalized
`settlementBatchId` values available to a Qualification. The Member UI therefore
does not invent a latest-batch selector and continues to show settlement metrics
as unavailable during its ordinary organization request. A caller that already
has an authoritative batch ID can use the exact-scope API and receives a
`settlementScope` containing the batch, period, rule version, parameter snapshot
hash, calculation hash, and finalized timestamp.

Adding a Member-visible settlement selector requires a separate additive,
authorization-scoped finalized-settlement index API. Until that index exists,
automatic selection by current date, current tree, or guessed period is prohibited.

This slice changes no PV, BV, GPV, Carry, K1, settlement, or replay calculation.
