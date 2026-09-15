# Qualification selection lifecycle

Remembering the selected ball is optional: failed reads/writes of the selection
key no longer discard an already loaded qualification list or throw during a
valid selection. Selection remains limited to qualifications returned by the API.
This does not change credential-storage or authentication policy, nor guarantee
that login works in a browser blocking all storage.

The qualification loader accepts an AbortSignal. Provider cleanup, retry and
StrictMode cleanup now cancel the underlying request. The existing alive guard
also rejects late results if cancellation is not respected by an adapter.

Validation: 79 tests PASS (76 retained, 3 new), TypeScript and Vite build PASS.
New tests cover selection-key storage failures, request cancellation on unmount,
and stale results after retry. This is frontend verification, not live LINE UAT.
No backend or R1.0B business rule changes; no production promotion.
