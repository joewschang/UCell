# LINE Account Security and Messaging UAT Checklist

## Preconditions

- Use isolated synthetic identities only.
- Admin role is one of `SUPER_ADMIN`, `MEMBERSHIP_OPS`, or `CUSTOMER_SERVICE`.
- Use a unique `Idempotency-Key` for every command.
- Do not configure or test against Stage or Production in this checklist.

## Person 360 account security

1. Open a Person 360 drawer and confirm the account-security section loads.
2. Confirm the LINE subject is masked; no raw token, bank value, or raw LINE user ID is rendered.
3. Enter the lock confirmation dialog, provide a reason, and confirm.
4. Verify `SECURITY_LOCKED`, session revocation count, and audit evidence through the authorized Admin read path.
5. Retry the exact command with the same idempotency key and confirm the original response is replayed.
6. Reuse that key with a different reason and confirm `409 IDEMPOTENCY_CONFLICT`.
7. Revoke active LINE binding with a confirmed reason and verify the member exchange path rejects it.
8. Create a rebind request using a verification reference only. Confirm no LINE token, raw identity document, or bank field is accepted.
9. Confirm a denied role receives `403 ROLE_DENIED`, expired session receives `401`, malformed input receives `422`, and conflicting command receives `409`.

## Member login and deep links

1. Start from `/organization`, `/bonuses`, `/shop`, `/orders`, and `/me` with LINE login required.
2. Complete the login redirect with a synthetic linked identity and confirm return to the original internal route.
3. Attempt an external or unknown Rich Menu action and confirm it resolves to `/`.
4. Confirm a locked Person, revoked binding, or invalid server session cannot access member data.

## LINE Messaging ingress

1. Send a synthetic signed payload to `POST /api/v1/integrations/line/messaging/webhook`.
2. Confirm a valid raw-body signature returns `200` and creates only inbox metadata plus normalized event metadata.
3. Confirm invalid signature returns `401` without persistence.
4. Confirm missing Messaging configuration returns `503`.
5. Confirm no raw payload, channel secret, message body, or raw LINE user ID appears in API response, audit, or database read model.
6. With explicit local worker enablement and approved local manifest, verify the exact `IDENTITY / LINE_MESSAGING / LINE_MESSAGING_DEFAULT` registration is observed. Unmatched registrations must enter manual review.

## Explicitly blocked until external approval

- First account link requires company-approved verification evidence; memberNo-only binding is prohibited.
- Rebind completion requires an approved secure completion-token delivery channel; neither Admin nor member UI may reveal the raw token.
- Connected Stage Messaging requires formal LINE credentials, secret storage, and provider enablement approval.

- [ ] Verify LINE message events move from PENDING to PROCESSED only for the supported identity event types; an unmatched event fails closed for review.
- [ ] Verify each approved notification class creates a CONFIGURATION_PENDING delivery record until a configured sender is available; no customer message is sent by this foundation.
- [ ] Verify the Admin Person 360 delivery list contains only delivery type, lifecycle state, and timestamps.

## LINE readiness and member state

1. As SUPER_ADMIN or MEMBERSHIP_OPS, call GET /api/v1/admin/integrations/line/status and confirm only boolean readiness, safe webhook metadata, and aggregate delivery counts are returned.
2. Confirm an unbound LINE identity receives the account-linking guidance; a locked identity receives rebind/support guidance; neither response discloses a Person, Ball, token, or LINE subject.
3. Confirm unauthorized roles receive 403 for the LINE readiness endpoint.
