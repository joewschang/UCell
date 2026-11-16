# Adapter/journal continuation results — 2026-11-16

Parent commit: `64a2c58080fc792c716236fee3701fd870751144` on independent local branch `prep/dot-uploader-token-age-261116`, clone `/workspace/scratch/85e57236c5c6/ucell-cloud-prep-independent-261116`. This continues the initial guard/uploader preparation; `PREPARATION-RESULTS.md` remains the historical record for that work.

No push, merge, deployment, PR #75 update, shared-checkout change, production HTTP request, image change, account/role/credential creation, network-policy change, SwaggerHub operation or paid model was performed. No live journal was provisioned; test journals were disposable and cleaned up.

## Delivered

- `https-adapter.mjs`: callable native Node HTTPS transport; explicit pinned HTTPS443 endpoint; TLS certificate verification; TLS >=1.2; per-request environment-proxy agent; no redirects; bounded request/headers/body; total timeout and abort destruction; fixed errors and no logs. Includes an encoding-only candidate client_credentials helper with no environment reads or HTTP.
- `retry-journal.mjs`: private local SQLite storage for exact body/key/digest/endpoint/date and state; immutable identity fields; FULL synchronous attempt reservation before I/O; separate SQLite process mutex; crash recovery; durable total cap 3; backoff; terminal success/permanent failures; cross-date expiry; corruption and missing-state fail-closed behavior. No token/secret columns or persisted raw errors.
- `uploader.mjs`: explicit bounded `maxAttempts` (journal forces 1); bounded auth/transport wait even for a provider ignoring cancellation; exports common endpoint/date validation. Existing guard code is unchanged in this continuation.
- `https-adapter.test.mjs`, `retry-journal.test.mjs`, expanded `uploader.test.mjs`, and two synthetic files in `test-support/`.
- `JOURNAL.md`, updated `UPLOADER.md` and README provide precise integration/recovery rules and boundaries.

## Actual validation

Command from repo root:

```sh
node --test deployment/cloud-greetings/uploader.test.mjs deployment/cloud-greetings/https-adapter.test.mjs deployment/cloud-greetings/retry-journal.test.mjs
```

**31 tests passed, 0 failed/skipped:** 13 uploader, 8 adapter and 10 journal tests. Coverage includes:

- HTTPS host/path/port/method/header pinning, TLS options, environment-proxy option handoff, no redirect following, discarded error bodies, response limits/content encoding/truncation, stream errors, cancellation, total timeout, no console logs and sanitized errors.
- Fixed fake sentinel form-encoding roundtrip with special characters and Unicode. This proves encoding only, NOT actual proxy placeholder replacement or Entra auth.
- Real local SQLite disk commits/reopens, same request across retries, counter/backoff preservation, cap exhaustion, permanent/transient/ambiguous outcomes, old-date expiry, immutable reservations, secret-free files with private permissions, corruption/missing file/symlink rejection.
- Actual child process SIGKILL before send and after simulated remote acceptance, automatic process-lock release and recovery with the identical key/body. A parallel process is rejected while the first holds the lock. All remote behavior remains mocked.
- Simulated journal commit failure using SQLite test triggers: failed reservation sends nothing; failed success storage leaves IN_FLIGHT and recovers without creating a new request.
- Provider timeout cannot later cause a delayed provider result to send a request.

`node --check` passed for uploader, HTTPS adapter and journal; all test modules were parsed/executed by node:test. `git diff --check` passed.

Not rerun because this continuation changes standalone MJS/docs only: API build, prior 5 suites/39 API tests, backend preflight/build. Their previous successful results are recorded in PREPARATION-RESULTS.md, not claimed as a fresh run. No configured deployment-MJS linter exists; the prior API lint blocker (missing eslint.config.*) remains. No full API/DB/CI/release tests were run.

No real external HTTP socket, TLS handshake, proxy CONNECT/substitution, token endpoint, production publish, storage power-loss test, NFS/distributed-lock test, automatic cloud schedule or PC-off UAT was performed. Request/stream mocks exercise adapter implementation; they do not establish live transport or authentication.

## Executor capability evidence (names/booleans only)

Observed Node v24.22.1 with `https.request`, `https.Agent`, `node:sqlite.DatabaseSync`, `AbortSignal.timeout`. The existing generated-image directory exists and image generation is available as a tool; no image was generated or today's image read/modified for this task.

The names `HTTPS_PROXY`, `https_proxy`, `HTTP_PROXY`, `http_proxy`, `NO_PROXY`, `no_proxy`, `NODE_USE_ENV_PROXY` are present. Their values were not printed or inspected for this assessment. No cookie/token files, environment-secret values or credential stores were read. Available tool metadata did not identify a verified generic Dot vault/environment-binding API; unrelated Sites APIs were not invoked.

Node officially supports proxyEnv agents in Node >=24.5. The adapter passes the environment proxy configuration into a private agent, but actual route behavior and any NO_PROXY exclusion must still be verified. Codex Cloud documentation describes HTTPS443 allowed-domain network-secret placeholders; it does NOT prove this executor is attached to the intended configuration or that form-encoding preserves proxy recognition.

## Remaining blockers and minimum-risk next step

1. Confirm the exact cloud environment and supported vault/network-secret interface with an authorized platform owner. Establish the intended executor binding and allowed-domain policy. No setting change is authorized or performed in this task, and no secret should be pasted into chat.
2. Verify or separately authorize a dedicated Entra API audience/publisher, v2 app-only token/idtyp, the pinned tenant/audience/client/object IDs and sole Greeting.Publish grant. No broad admin/deploy identity is acceptable. Configure custody only through the supported platform mechanism after authorization.
3. Implement the token provider and perform an approved isolated integration of actual placeholder/form encoding, Entra issuance and real claim checks. Keep tokens memory-only; do not treat the sentinel mock as evidence of successful auth.
4. Configure approved storage with persistence across the actual schedule's workers, retention/backup/capacity and single-host locking guarantees (or redesign coordination for a shared service). Current local SQLite files alone do not establish cross-schedule cloud durability. Missing files must never trigger silent new-journal creation.
5. Only after those prerequisites, run authorized staged TLS/proxy/redirect/cancellation and idempotent publication/QR/date-boundary/PC-off tests, then existing release/backup/restore gates. Production enablement remains blocked.

Sources: [Node 24 HTTP proxy support](https://nodejs.org/docs/latest-v24.x/api/http.html#built-in-proxy-support), [Node SQLite](https://nodejs.org/api/sqlite.html), [Cloud environments/network secrets](https://learn.chatgpt.com/docs/environments/cloud-environments).
