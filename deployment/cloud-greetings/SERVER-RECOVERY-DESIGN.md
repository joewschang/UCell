# Server DB recovery proposal — design only

No endpoint, migration, runtime behavior or production setting is changed by this document. This proposal uses UCell's existing PostgreSQL service and server-side identity boundary; it does not grant Dot direct database credentials. The cloud executor's local SQLite directory is a cache/retry aid, not authoritative cross-schedule storage.

## Evidence from the current source

`greeting-push.service.ts` calls `validateGreetingPush` (including the current released Taipei date) **before** looking up `request_id`. Consequently even a previously committed request cannot currently be replayed through POST after its date expires. `greeting-automatic-publication.ts` uses the date advisory lock and serializable transaction to insert the publication, generation receipt and audit atomically, preserving immutable published dates.

The PR migration `20261116090000_daily_greeting_generation` contains request_id, request_hash, actor_subject, greeting_date and publication_id; the publication row contains the final image. The migration is present in the source baseline, but production deployment of this table is not verified. The existing push route records its receipt only with publication. It does not persist the original upload before rendering. The generation row's attempts are also used by the optional Azure generation path; do not reinterpret that counter as a Dot HTTP retry budget.

The local journal SHA-256 hashes the exact JSON wire string. The server request_hash instead hashes JSON `[date,title,message,SHA256(decoded PNG)]`. These digests are deliberately different and must not be compared directly. Future records should name/version both wire identity and canonical server identity when both are needed.

## Phase A: smallest change for committed-result reconciliation

Propose a narrow authenticated **read-only** receipt lookup, implemented later under a separate reviewed API change. It can query the existing generation/publication join without schema changes if the PR table actually exists. Use the same pinned tenant/audience/client/object, RS256 app-only identity and sole Greeting.Publish role; constrain results to the authenticated actor. No admin/member/finance data, bearer values, raw upload or publication mutation is exposed.

Lookup supports date plus original request UUID/canonical identity when available. If the local journal is lost, a bounded by-date lookup for this actor can return the server's original request identifier and receipt. It reports either a matching published receipt, a conflicting publication/date reservation, or UNKNOWN; do not label absence as proof a request was never sent. A request may still be in flight, the table may not exist, or storage might be unavailable. A DB/config failure is UNAVAILABLE, never UNKNOWN or permission to regenerate.

Permit authenticated receipt reads for a bounded historical window (proposed 90 days, always >=2026-11-17), while keeping all POST date eligibility checks unchanged. Return only date, original request ID, canonical identity/version, publication ID and committed status. Wrong actor/key/hash yields a generic non-disclosing conflict/not-found response. Include audit and rate limits, with no broad listing endpoint. A read-only acknowledgement after midnight must never render, insert a publication, change its date or bypass immutability.

Recovery decisions:

| Server evidence | Action |
| --- | --- |
| Matching published receipt | Mark local job reconciled, no POST or new artwork. |
| Another publication/reservation for this date | Stop with conflict; never overwrite or delete it. |
| UNKNOWN and exact original key/body survive, date still eligible | Bounded same-key/body retry only. |
| UNKNOWN and payload/key lost | Stop for reconciliation; do not invent a new publication attempt. |
| Old date with no matching committed receipt | Report unresolved/expired; no old-date write or date rewriting. |
| Database/identity/service unavailable | Remain unresolved and retry the read safely later. |

Phase A solves discovery of a committed result across executions/days, not recovery of an upload whose original bytes were never durably received.

## Phase B: durable intake in the existing UCell DB

For recovery after local workspace loss **before** publication, the server must retain the validated original payload. Existing receipt columns cannot reconstruct an unbranded source PNG from a final composited image. Do not hide large payloads in audit JSON/error_code or silently reuse the optional generation state/counter.

The minimally invasive full solution would be one additive, bounded intake table in the existing PostgreSQL service, linked to the publication flow. This is a future migration proposal, not included here. Store immutable date, dedicated actor, request UUID, canonical hash/version, exact validated request JSON bytes (or explicitly versioned equivalent if wire-exact replay is no longer needed), state, attempts, retry/lease timestamps, lease owner/fencing generation and publication ID. Unique constraints cover date and request ID; actor/key/payload substitutions conflict. Cap input at the current PNG/JSON limits and impose storage quota/retention. Never store bearer tokens, client secrets or raw upstream exceptions.

The existing POST can become durable intake plus bounded processing without introducing another write credential or a second image-generation provider:

1. Authenticate and validate the current eligible date, copy and PNG before accepting input. Reserve the original identity and payload in a short DB transaction under the date lock. Commit before rendering; ambiguous client failure is resolved against this row. Reject different payload/key for an existing date.
2. An internal opt-in worker/startup recovery loop leases eligible intake rows, atomically reserves bounded attempts, renders outside the DB transaction, and finishes via the existing publication/audit transaction. A fencing token prevents a stale worker from committing after another worker takes over. No long DB lock is held during native rendering. No paid model or delegated admin identity is involved.
3. Publication, final intake state and audit must commit atomically under the date lock, including cross-date background deduplication. Server time/date is rechecked at finalization, as today. After 07:00 Taipei rollover, unfinished older rows expire; they remain readable for reconciliation but cannot create a late publication.
4. The read-only receipt operation from Phase A can report ACCEPTED/PROCESSING/RETRYABLE/PUBLISHED/EXPIRED/EXHAUSTED for this dedicated actor. Dot polls receipts rather than downloading a stored background or creating a new image after losing its local files. This avoids a payload-download endpoint.
5. Delete source payload bytes only after a defined terminal retention period; keep compact immutable receipts long enough for the agreed replay/reconciliation horizon. Backup restores must be reconciled against published rows before workers resume. Never reset counters or remove published-date protections as recovery.

If old work must eventually publish after its date boundary, that is a separate product/policy change and is explicitly excluded here. Cross-day recovery in this proposal means finding the authoritative outcome, not authorizing stale writes.

## Validation required before implementation/activation

Review API/role scope and data retention first. Then test read after commit with lost response; no-row while an intake is concurrently committing; wrong actor/key/hash; unavailable DB vs absent receipt; process death before/after intake and publication commits; two workers/fenced leases; retries after volume loss; exact release-boundary expiry; immutable published dates; source quota/purge; and backup restore. Confirm the generation migration's actual deployment status read-only before relying on it. None of these new server behaviors is implemented or tested by this task.
