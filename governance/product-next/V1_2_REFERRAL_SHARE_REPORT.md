# V1.2 Referral Share Entry — 2026-09-17

Status: MEMBER SHARE ENTRY + 30-DAY ANONYMOUS LANDING ATTRIBUTION IMPLEMENTED; Person binding and LIFF transition remain later slices.

An authenticated member can request a server-generated HTTPS referral URL for the currently selected owned Qualification. The Backend rechecks temporal ownership, encrypts the Qualification identity in an expiring authenticated token and fails closed when URL/secret/TTL configuration is absent or invalid. Foreign Qualification requests are denied. The client never sends Sponsor identity and cannot construct or alter the referral token.

The Member Sponsor view now creates the URL on explicit user action and uses the device share API or clipboard fallback. It validates that the response belongs to the selected ball and does not treat sharing as Sponsor creation, placement or monetary recognition.

Migration `20260917040000_v12_referral_attribution` adds persisted referral-link digests, one current anonymous attribution row and append-only touch history. `POST /api/v1/referrals/landing` uses server time inside a Serializable transaction with an advisory lock per anonymous ID. The first valid touch locks the referrer Qualification for exactly 30 days. A same-referrer touch updates `lastTouchAt` without extending `lockedUntil`; a competing touch during the lock is retained as evidence without replacement; the first competing touch at or after expiry replaces the provisional attribution and begins a new 30-day window. None of these transitions creates or rewrites Sponsor.

Fresh DB Golden verifies all 32 forward migrations and 348 Member Identity HTTP/DB assertions, including public unauthenticated landing, token-digest persistence, exact lock boundaries, same-referrer behavior, competing-touch evidence, expiry replacement, append-only history and unchanged Sponsor relationships. Member tests verify request shape, response-ball mismatch rejection and absence of client Sponsor mutation. Person binding and LIFF transition state are intentionally not claimed by this checkpoint.
