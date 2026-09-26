# Phase 1 Stage RC Plan — Ready, Not Deployed

Target source is frozen tag phase1-local-baseline-20260926 at $base. Stage remains STOP until separately authorized.

Prerequisites: approved Stage change window; verified backup and rollback owner; Key Vault references for database, payment/provider, LINE and Entra configuration; no Production credentials; synthetic Stage UAT data; Stage LINE callback/LIFF allow-list confirmation.

Procedure: confirm tag and artifact hashes; back up Stage DB; run migration preflight and forward migrations once; deploy exact frozen artifact; verify health, OpenAPI, RBAC/BOLA, P0 identifiers and no UUID exposure.

UAT evidence: Paper application → receipt → payment → pending placement → ball allocation; member retail cart/delivery/payment/order history/fulfilment handoff; parent-ball placement and retry; existing/new Person LINE link/rebind boundaries; Retail referral attribution, award, settlement and return recovery; Admin Operations/Support/Finance/Audit role separation.

Rollback: stop on failed migration, health/security regression, P0 privacy leak, economic Golden mismatch, failed payment/placement/LINE journey, or unapproved configuration drift. Restore approved DB backup and prior tagged artifact; retain logs and evidence. No destructive data remediation without separate approval.

Stage data policy: synthetic identities only unless an approved controlled UAT data policy explicitly authorizes otherwise. Do not copy Production member data.
