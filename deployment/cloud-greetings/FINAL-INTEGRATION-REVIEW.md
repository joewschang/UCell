# Final local integration review — 2026-11-16

Reviewed base `dc866bfcc5facefe8ca330962b581a744851bed0` on the existing independent branch `prep/dot-uploader-token-age-261116`. Same cloud task and checkout; no new task, push/merge/deploy, production request, identity/secret/role creation, settings change, SwaggerHub action or image change.

## Evidence-based fix

A new focused reproduction returned `BUG: body read remains pending after 10ms deadline`: after an injected transport returned a Web Response, uploader awaited `reader.read()` outside its abort wrapper. The timer fired but a non-cooperative stream could indefinitely hold the upload and journal mutex. Awaiting an uncooperative `cancel()` also had the same risk.

`uploader.mjs` now applies the existing attempt AbortSignal to each body read and performs best-effort cancellation without waiting indefinitely. Cancellation promise rejections are swallowed; raw errors never escape. Invalid/error bodies are cleaned up. The Node HTTPS adapter already buffers only a bounded body and destroys its request/socket on timeout; this change closes the generic injected-transport interface boundary as well. It does not weaken any signature, role, date or idempotency validation.

Added one regression test covering stalled body reads and hung cancellation, plus an end-to-end local chain test from journal -> uploader -> HTTPS adapter -> mocked native request/stream boundary. The chain verifies same key/body after 503, ALREADY_PUBLISHED recovery and no synthetic bearer bytes in SQLite files.

## Fresh validation this turn

- Baseline standalone suite: 31/31 passed before the new regression was added.
- Final standalone suite: **33/33 passed** (14 uploader, 8 adapter, 11 journal).
- API focused tests: **5 suites / 39 tests passed**, freshly rerun. Includes strict token-time boundaries for both roles, pinned identity/signature checks, HTTP authorization and native image/complete-artwork regressions.
- All backend workspace builds passed: contracts, database, shared, settlement, API and worker.
- `node --check deployment/cloud-greetings/uploader.mjs` and `git diff --check` passed.

Commands from repository root (backend commands run inside `backend/`):

```
node --test deployment/cloud-greetings/uploader.test.mjs deployment/cloud-greetings/https-adapter.test.mjs deployment/cloud-greetings/retry-journal.test.mjs
npx --yes pnpm@12.4.1 --filter @ucell/api exec jest --config ./test/jest-e2e.json --runInBand --runTestsByPath test/cloud-greeting-security.e2e-spec.ts test/greeting-push-http.e2e-spec.ts test/cloud-greeting-http.e2e-spec.ts test/greeting-push-native.e2e-spec.ts test/greeting-complete-artwork.e2e-spec.ts
npx --yes pnpm@12.4.1 -r build
```

The API/build runs completed on the unchanged backend code; subsequent changes were only standalone MJS/tests and documentation. Full API suite, isolated PostgreSQL suite, production migration, actual network/TLS/proxy auth, staged publication and PC-off UAT were not run. Prior missing-eslint.config lint blocker remains; no new lint success is claimed.

## Security/recovery review

- Guard still requires valid RS256/issuer/audience, four pinned identities, app-only/no scope, sole route-specific role, strict first-hour age and at most 90-minute signed lifetime; no tenant lifetime policy changes.
- Tokens appear only in transient provider/HTTP objects; no token fields exist in journal, no token logging is implemented, and tests scan journal files for the synthetic bearer. This cannot prove physical memory erasure or control external providers, diagnostics or crash dumps.
- Journal reserves attempts durably before auth/HTTP, excludes concurrent processes, retains immutable body/key, rejects corrupt/missing files, and never silently recreates state. Persistent three-attempt cap includes crashes. Permanent failures stop; ambiguous responses keep original identity; expired dates never POST. Local SQLite is NOT cross-schedule cloud storage.
- Test cases cover actual child SIGKILL, fail-before-send and fail-after-success commit windows, plus mock transport cancellation. They do not prove machine power-loss durability, distributed storage behavior or live auth.

## Existing executor capability check

Only capability metadata and variable names were examined. Observed Node v24.22.1, native HTTPS and SQLite support. Present names: HTTPS_PROXY, https_proxy, HTTP_PROXY, http_proxy, NO_PROXY, no_proxy, NODE_USE_ENV_PROXY; matching environment-binding name: CODEX_ENVIRONMENT_ID. No value was read/printed for this assessment; no cookie/token files or vault contents were queried.

The currently callable tool metadata exposes no verified saved-environment-config attachment/rebinding or generic OIDC/network-secret handoff for this existing task. Parent context reports environmentConfigId selection for **new work only**; this is not evidence that this running task can be rebound or that a recurring schedule automatically inherits named secrets. CODEX_ENVIRONMENT_ID alone proves neither. This is a capability evidence limit, not a claim that the platform has no such feature anywhere.

No new task or environment configuration was created to work around this limitation. Actual environment/vault binding, allowed destinations, proxy placeholder recognition after form encoding, dedicated Entra identity and cross-schedule storage remain unverified. Any future setup must use supported platform interfaces and separately authorized scope, never secrets pasted into chat or unrelated Sites/admin/deploy credentials.

## Server-side recovery design only

`SERVER-RECOVERY-DESIGN.md` proposes minimal read-only reconciliation from the existing generation/publication receipt join, preserving current POST date rules. It explicitly distinguishes the local wire hash from the server canonical hash. For payload recovery after local volume loss, a later additive intake table in the existing UCell PostgreSQL service would be needed; the current receipt does not store original source bytes. No endpoint or migration was added in this task.

Next step: have an authorized platform owner verify the exact saved environment/vault binding and scheduling inheritance capabilities first. Review the server reconciliation proposal and actual generation-table deployment status separately. Only after dedicated publisher/audience/sole Greeting.Publish permission and secure custody are authorized should live isolated auth/transport and staged PC-off tests proceed.
