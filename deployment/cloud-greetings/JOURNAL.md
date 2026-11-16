# Local durable retries and HTTPS transport

This implementation is prepared for integration, not activated. No actual auth or network request is made by importing these modules. Use Node >=24.5 on a Linux local filesystem with reliable SQLite locking/fsync, not NFS, object storage or independent copies on multiple hosts.

## Explicit setup and invocation

- `initializeJournal(absoluteDirectory)` creates a new private directory (0700) and two SQLite files (0600). It fails if the directory already exists. Call once as an explicit provisioning step, never automatically when a scheduled run cannot find state. No runtime journal was provisioned by this engineering task; tests use disposable synthetic directories.
- `enqueueJournal({directory,publishEndpoint,request,now?})` stores the exact prepared JSON string, UUID, SHA-256 identity, endpoint and date. It validates PNG/JSON/date first. A second enqueue is accepted only for exactly the same date/key/body/endpoint. No state, including BLOCKED/EXPIRED, permits replacing the job for that date.
- `runJournal({directory,date,tokenProvider,transport,now?})` makes at most one attempt. Supply `createHttpsTransport({publishEndpoint})` as transport and a separately approved memory-only token provider. The stored endpoint is immutable and the adapter separately pins its configured endpoint. No credentials are accepted as journal fields.
- `inspectJournal({directory,date})` returns state, attempts, next attempt time, UUID and digest, plus the sanitized terminal result if successful. It does not return the image or token.

A future scheduler must inspect/recover an existing job before generating a replacement. A missing/corrupt journal is a stop condition, not permission to initialize a new one. The date must be the current released Taipei date, never before 2026-11-17. The image must remain unbranded and satisfy the existing strict PNG subset.

## Persistence and concurrency

`jobs.sqlite` uses SQLite FULL synchronous commits. The exact payload/key and request digest are committed before any attempt. The attempt counter and IN_FLIGHT state are committed **before** token acquisition or HTTP; this conservatively consumes one of three slots even if a crash occurs before sending. There is no counter reset API and no automatic job deletion. Database triggers forbid updating the request identity fields.

A separate `lock.sqlite` holds a `BEGIN IMMEDIATE` transaction across each operation, including network waiting. A competing process fails with `JOURNAL_BUSY`; it cannot increment or send. Process exit/SIGKILL releases this OS-backed SQLite lock. The request journal can commit durably while this independent lock remains held. A stalled process is bounded by provider/transport timeouts; never delete lock files to take over. Every operation checks directory ownership/permissions, disallows symlinked paths/files, requires existing DB files, runs SQLite quick_check and validates row structure/digest. Corruption fails closed. The checksum detects accidental payload changes; it is not an authentication mechanism against an attacker who controls the same OS user or directory.

Local files must remain on the **same durable volume** across scheduled runs. The current workspace's retention, guaranteed attachment to later jobs, backups and loss recovery have NOT been established. This is not distributed coordination and not a configured cloud storage service. Copying the journal to another worker or restoring an older backup can roll back counters; stop and reconcile server publication state before any such recovery. Do not claim complete PC-off scheduling durability until these deployment properties are proven.

## State transitions

| State | Next behavior |
| --- | --- |
| READY | Reserve attempt, persist IN_FLIGHT, then authenticate/send. |
| IN_FLIGHT after crash | Once process lock is released and backoff has elapsed, resend identical key/body; never assume failure means unpublished. |
| RETRYABLE | Same request only, after persisted next-attempt time, within total cap. |
| SUCCEEDED | Return stored result without another request, including on later dates. |
| BLOCKED | Stop: auth unavailable, permanent HTTP rejection or conflict. No automatic new key, permissions expansion, or overwrite. |
| EXPIRED | Stop and reconcile manually: the API rejects old dates, including an old-key retry. Do not rewrite the date or infer publication success/failure. |
| EXHAUSTED | Stop after three durable attempts, including ambiguous/interrupted ones. No bypass via re-enqueue. |

Standalone uploader retries network errors and HTTP 429/502/503/504. The journal forces standalone `maxAttempts=1`, so its durable budget is authoritative. Malformed/oversized/interrupted success responses are ambiguous and retained for same-request retry. HTTP 401/403/409 and other non-transient statuses stop; redirects never follow Location. Retrying the same key does not create exactly-once transport delivery, but lets the server's immutable/idempotent transaction determine the outcome. Backoff is persisted (1/2/4 seconds for reserved attempts); callers should schedule sensibly rather than busy-loop. A normal terminal commit is durable; if storing success fails after HTTP, IN_FLIGHT remains, requiring same-key reconciliation/retry.

## HTTPS adapter and runtime boundary

`createHttpsTransport` uses native `https.request`, with the exact configured HTTPS DNS host/path on port 443. It reconstructs headers so callers cannot override Host, CA, agent, TLS, or port. TLS certificate checks remain enabled; minimum TLS1.2; custom per-request agent inherits the environment's proxy settings without global mutation. `NO_PROXY` still applies: the actual configured proxy route must be checked before relying on network-secret substitution. Request body is limited to 10,670,000 UTF-8 bytes; response headers to 8192 bytes; successful JSON response to 4096 bytes; no response decompression. A total deadline covers connect/headers/body and destroys sockets on failure or cancellation. Non-200 bodies are discarded and all errors have fixed codes, with no module logging. No HTTP redirect is followed.

A fixed fake sentinel (`+`, spaces, `&`, `=`, `%`, Unicode) roundtrips through `encodeClientCredentials`. This helper only constructs an `application/x-www-form-urlencoded` body for a GUID tenant/client and `api://GUID/.default` audience. It cannot establish that this Dot executor receives the intended environment network-secret placeholder, that the proxy recognizes its encoded representation, or that Entra receives the correct value. Custom App ID URIs would need a separately reviewed contract; do not guess the audience.

Native HTTPS / SQLite support and proxy variable *names* were observed in this executor; no secret values/cookies/tokens were inspected. The image tool exists and a generated-image directory exists, but no new image was generated or today's image inspected/modified for this task. Available tool metadata did not establish a generic authorized Dot vault/environment-binding API. Sites credentials/settings belong to a different service and were not used.

## Required activation work

1. Confirm the intended cloud environment and its supported vault/network-secret binding, allowed domains and proxy path using the platform UI/API. Verify this exact executor receives the chosen placeholder, without exposing the underlying secret. This requires separately authorized platform configuration; none was changed here.
2. Verify or separately authorize the dedicated Entra API audience and publisher, v2 app token/idtyp claims, pinned tenant/client/object/audience IDs and sole `Greeting.Publish` grant. No admin/deploy/Graph credentials or paid Azure image model are substitutes.
3. Implement the actual token provider using the approved custody mechanism. Test real form substitution/encoding and token issuance in an authorized isolated integration; keep bearer memory-only and refresh within the effective first-hour window. The encoding mock is not live-auth evidence.
4. Attach an approved persistent volume/store to all scheduled executions, with ownership, retention, capacity, locking and recovery guarantees. Do not initialize a second empty journal if state disappears.
5. Run real TLS/proxy cancellation/redirect tests, staged end-to-end idempotency/date-boundary/QR/image retrieval and PC-off UAT; then follow existing release/backup/restore/deployment authorization gates. Until then, keep production disabled.

References: [Node 24 HTTP proxy support](https://nodejs.org/docs/latest-v24.x/api/http.html#built-in-proxy-support), [Node SQLite](https://nodejs.org/api/sqlite.html), [Cloud network secrets](https://learn.chatgpt.com/docs/environments/cloud-environments).
