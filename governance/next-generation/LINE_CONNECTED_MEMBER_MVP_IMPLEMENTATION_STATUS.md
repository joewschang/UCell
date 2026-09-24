# LINE Connected Member MVP — Implementation Status

## Implemented locally

- LINE ID token is verified by the backend before a UCell member session is issued.
- Active/revoked LINE binding lifecycle, Person security lock, session revocation, rebind request, dual-control service logic, audit evidence, and 24-hour completed-rebind cooldown are implemented.
- Admin Person 360 exposes masked binding lifecycle and governed lock, revoke, and rebind-request actions.
- LINE Messaging webhook validates the exact raw request body with HMAC-SHA256, stores no raw payload, writes a deduplicated `IDENTITY` inbox row and normalized event metadata, and has a disabled-by-default observer worker registration.
- Rich Menu action contract maps only approved actions to internal Experience V2 routes.

## Fail-closed external dependencies

| Capability | Required dependency | Current behavior |
| --- | --- | --- |
| First LINE account link | Company-approved verification evidence source | No memberNo-only binding endpoint exists. |
| Rebind completion token | Approved secure delivery channel | No Admin or member API returns the token. |
| Messaging production ingress | LINE Messaging channel secret and config version | Webhook responds unavailable until configured. |
| Messaging worker | Approved provider enablement manifest and explicit worker flags | Handler is not registered by default. |

## UAT scenarios available without external credentials

1. Admin Person 360: masked binding read, locked state, reason-confirmed lock, binding revoke, and rebind request.
2. Member: intended destination is retained through the LINE login redirect lifecycle.
3. Webhook: synthetic raw-body signature validation, duplicate ingress metadata, normalized event persistence, and worker observer registration.

No Stage or Production action is authorized by this document.
