# LINE Rich Menu operations and UAT

## Production LIFF entry correction — 2026-10-14

Supersedes the direct website entry below. The default menu is now
`richmenu-4e80a60b66189c4ce28398a608682700`, using
`https://liff.line.me/2012021712-Dqh6Z8aq/` plus `/events`, `/shop`, `/faq`.
Direct website links opened LINE's ordinary in-app browser and displayed the web
login chooser. The LIFF URL launches the intended LIFF flow. Default readback
and artwork comparison passed; migration from the direct-link per-user menu
was accepted asynchronously. Check `line-production-liff-menu-verification.json`
in C:/UCell/releases/production-20261014 for batch status. Real mobile login is
still user verification, not inferred from the menu API response.

## Production entry cutover — 2026-10-14

The user authorized changing OA `@258vmvsa` to the production member website.
Production menu: `richmenu-f5ef3a7fc29cd575d7539f29bd7494c4`; four direct HTTPS
links under `https://member.ucell.life` (`/`, `/events`, `/shop`, `/faq`).
Stage Worker `LINE_RICH_MENU_ENABLED=false` must be preserved so it cannot
restore Stage menus on the shared OA. The October 8 IDs below are historical.
Production LIFF/login and public access are still separate pending work; direct
website links do not configure LINE authentication. Deployment/readback evidence:
`C:/UCell/releases/production-20261014/line-production-menu*.json`.

## Historical decision — 2026-10-08

All OA friends must see the same four tiles: 會員中心、活動報名、線上商城、常見問答 (Stage links). Set **both** Worker variables to `richmenu-75ad1b5ee333139d926f12664750f897`:

```text
LINE_DEFAULT_RICH_MENU_ID=richmenu-75ad1b5ee333139d926f12664750f897
LINE_MEMBER_RICH_MENU_ID=richmenu-75ad1b5ee333139d926f12664750f897
```

Changing only the LINE API default is insufficient: Worker reconciliation restores the configured default every minute. This caused the reported three-tile regression despite successful API readback and batch replacement. Keep these values in subsequent deployments. `provision-default.cjs` and `default-v1.*` below are historical three-tile provisioning assets; do not run them for the current four-tile decision. The remaining October 3 behavior/UAT description is historical and superseded by this decision.

Next action: verify an unbound friend's physical LINE client after reopening the OA chat, following healthy Worker rollout and observation across reconciliation cycles. No member binding is required to see the default four-tile menu.

OA: `@258vmvsa`. These definitions point to **Stage**, not Production.

## Audit and cause (2026-10-03)

Messaging API initially returned HTTP 404 for `GET /v2/bot/user/all/richmenu`.
It listed one existing menu, `richmenu-e0c748d7465b76699686999dba8f2079`
(`UCell Stage Member Services 20261001`), offering member center, shop and orders.
The single valid LINE userId currently known to the database was linked to that
menu. Seven synthetic Stage subjects were excluded from live LINE operations.

The repository previously contained front-end deep link definitions, but no
default provisioning, automatic user linking, or reconciliation. The webhook
worker acknowledged metadata only. Consequently, friends without a per-user
link had no Messaging API fallback. A friend who joined before webhook launch,
or whose binding failed, had no automatic repair path. Historical manual link
creation is outside the current repository; its actor is not established.

Block is delivered as `unfollow`; add/unblock as `follow`. We do **not** assume
LINE automatically removes a per-user link on block. The worker skips a known
blocked friend, and a later follow wakes maintenance. If no link remains, the
global default provides the entry while maintenance repairs eligible bindings.

The followers enumeration endpoint returned HTTP 403, so this account cannot
enumerate every friend with the available API access. OA Manager menus cannot
be listed using Messaging API. **OA Manager default remains unverified pending
the owner's LINE Business ID login**; do not interpret the API list as proof
that no OA Manager menu exists.

## Behavior

LINE display priority is per-user > Messaging API default > OA Manager default.
The new default contains member center (LIFF), a user-initiated `客服` message,
and browser login. It applies independently of webhook delivery or binding.
The existing member services menu remains the personalized override.

Worker flags, all public except the existing token reference:

```text
LINE_RICH_MENU_ENABLED=true
LINE_EXPECTED_BASIC_ID=@258vmvsa
LINE_DEFAULT_RICH_MENU_ID=<verified default ID in Stage evidence>
LINE_MEMBER_RICH_MENU_ID=richmenu-e0c748d7465b76699686999dba8f2079
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=secretref:line-channel-access-token
```

The worker verifies the expected OA, default definition and uploaded image,
sets/readbacks the default when necessary, then maintains links for active
verified LINE identities belonging to effective people with normal security
status. It never grants membership, writes identity links, or changes orders.
When the separately gated provider webhook processor is enabled, follow wakes
the next cursor pass. On the audited Stage runtime that processor is disabled;
the independent periodic scan still reads ingress follow/unfollow history and
repairs on its next pass. New bindings are picked up by periodic scans
without any LINE call inside the login/binding transaction.

Maintenance runs at most one pass concurrently, every minute, in pages of 20.
Each pass stops starting users after 25 seconds and preserves its cursor; each
HTTP request has a 5 second timeout. Presentation work does not delay the
economic worker tick. Errors are retried on later full scans and logged as
aggregate counts. No raw userIds, tokens or provider response bodies are logged.

A missing replacement menu falls back to the verified default; a transient
failure retains any working current menu. Replacement verifies definition and
artwork before changing the link and checks the resulting user link. An invalid
default prevents any per-user mutation. Revoked/ineligible bindings are
unlinked after the global fallback is verified.

## Operator reconciliation / replacement

In the authorized runtime with the existing secret environment, inspect
`GET /v2/bot/info`, `/richmenu/list`, `/user/all/richmenu`, then the known valid
userIds' `/user/{userId}/richmenu`. Keep results aggregate and omit userIds.
Do not expose credentials in command arguments or issue comments.

Run a complete known-binding repair from the built backend:

```sh
node scripts/line-rich-menu-reconcile.cjs --apply
```

The CLI exits nonzero on failures or its 1000-page limit and prints totals.
Regular scans continue retrying. Unknown/unbound friends use the global default
without being collected into a new identity database.

Provision the default with `node deployment/line-rich-menu/provision-default.cjs`
from a runtime containing this folder and existing LINE credentials. The script
guards the exact OA, reuses a matching menu by name, compares existing artwork,
uploads only if missing, sets default and verifies both bytes and ID. Do not
delete the old menu as part of replacement. For a future member menu, first
create/upload/verify it, then change `LINE_MEMBER_RICH_MENU_ID`; reconciliation
replaces links. Revert the public ID to restore the previous menu.

## Human UAT (mobile LINE, not desktop LINE)

Automated checks do not substitute for these tests. Record account category,
time, result and screenshot without publishing LINE userIds.

1. New unbound friend: add OA, close and reopen chat, allow up to one minute for
   default propagation. Confirm `進入 UCell` with member center, customer service
   and Web login. Member center should allow login/registration.
2. Existing friend from before webhook launch: reopen chat without binding or
   sending a message. Confirm the same default entry.
3. Bound member: confirm member center/shop/orders personalized menu; test that
   member center reaches the member flow with the correct authenticated state.
4. Block then unblock a test account: confirm default or personalized entry on
   reopening; allow the periodic maintenance pass to restore eligible links.
   Blocking itself must not create membership or monetary changes.
5. With a designated test identity only, remove its per-user link using LINE's
   unlink endpoint. Confirm default immediately/as chat reopens, then run
   reconciliation and confirm the member menu returns. Do not unlink a real
   member merely to manufacture test evidence.
6. Missing and replacement menus: automated transport tests cover missing
   artwork/menu, replacement and readback. For live testing use a designated
   test identity/menu, keep default configured, link a verified replacement,
   verify all actions, then restore its previous menu.
7. Direct fallback: open `https://stage.ucell.life/login` and
   `https://liff.line.me/2011813061-Qt3d2jmo` without opening a Rich Menu. Login
   and registration must not depend on link success.
8. Tap customer service once on a test account; confirm the user-initiated
   message appears in the OA conversation. No unsolicited push is sent by the
   provisioning or reconciliation scripts.

Sources: [LINE rich menu overview](https://developers.line.biz/en/docs/messaging-api/rich-menus-overview/),
[per-user fallback](https://developers.line.biz/en/docs/messaging-api/use-per-user-rich-menus/),
[Messaging API reference](https://developers.line.biz/en/reference/messaging-api/).
