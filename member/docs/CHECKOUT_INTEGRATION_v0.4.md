# Member checkout v0.4 — demo implementation and integration boundary

This increment follows 07ad2cc on feature/member-liff-mvp. It changes only Member
frontend code/tests/docs. R1.0B, Backend and existing release gates are unchanged.

## Implemented interaction

Catalog → qualification-scoped cart → quantity/remove → shipping validation →
review (explicit qualification and ball) → confirm demo order → scoped orders.
Cart survives client-side route and qualification changes in memory. Switching
qualification resets shipping/review. Refresh clears demo carts and new orders.
Receipt records retain no shipping name, phone or address. Demo input is never
posted, logged or written to localStorage/sessionStorage by this implementation.
Demo catalog price/PV is illustrative (4,800 / 2,880); subtotal is demo-only and
excludes freight. No PV, active status, inventory or bonus entry is generated.
Quantity 1–99 is a demo UI bound, not an approved production purchasing limit.
Duplicate confirmation keys return the same receipt synchronously; cross-ball
reuse is rejected. This is a UI simulation, not server-side idempotency proof.

## Real mode

Real products remain read-only even when available=true. Commerce methods also
reject calls when demo mode is disabled. No POST endpoint is called. Existing
LINE authentication gate remains closed until approved Member session exchange.
The current branch contains no implemented Member session/order API contract.

## Backend handoff — proposal, approval/integration still required

1. Verify LINE identity server-side, bind Person and establish Member session.
   Do not accept client-decoded identity, current admin tokens or client ball ownership.
2. Quote receives authenticated qualificationId, product IDs/quantities and shipping
   context. Server owns eligibility, SKU prices/PV, tax/freight, availability and
   quote expiration/version. Final DTO/path and monetary serialization remain pending.
3. Quote result must identify qualification, lines, final currency/totals and expiry.
   Client invalidates review when cart, qualification, shipping or quote changes.
4. Existing proposed POST /api/v1/member/orders consumes a server quote and a unique
   idempotency key. Backend validates ownership, unchanged quote and idempotency
   atomically. A reused key with a changed payload is a conflict, not a new order.
5. On timeout/unknown outcome, recover the same attempt using its key or order lookup;
   do not create another key automatically. UI needs submitting/unknown/retry states.
6. Order response and GET /member/orders must echo authorized qualification ownership.
   Server persists shipping under the approved privacy policy. The demo receipt type
   is not a proposed canonical backend order/shipping model.
7. Payment initiation, confirmed payment, inventory acceptance and shipping are distinct
   server states. Never mark payment successful from a browser redirect alone.

Required integration cases: two real Persons; foreign qualification/order denial;
expired session/quote; changed price; unavailable SKU; duplicate request; timeout
recovery; payment reconciliation; shipping failure; keyboard/mobile/LIFF UAT.
Eligible consumption, EPV timezone, PV/BV mapping and operational calendar remain
Pending Decision. Do not derive those rules from demo checkout.
