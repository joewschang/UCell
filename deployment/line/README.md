# LINE OA four-service menu

Production entry update (2026-10-14): the shared OA now uses menu
`richmenu-f5ef3a7fc29cd575d7539f29bd7494c4`, with direct links to
`https://member.ucell.life/`, `/events`, `/shop`, and `/faq`. Stage rich-menu
reconciliation is disabled to preserve this change. Production LINE login and
general public access remain pending. The Stage details below are historical.

Same OA: `@258vmvsa`. Stage LIFF: `2011813061-Qt3d2jmo`.

| Position | Label | Member route |
|---|---|---|
| Top left | 會員中心 | `/` |
| Top right | 活動報名 | `/events` |
| Bottom left | 線上商城 | `/shop` |
| Bottom right | 常見問答 | `/faq` |

`render-four-menu.ps1` renders the 2500 × 1686 PNG. `four-menu.mjs` generates four equal hit areas using an explicit environment and real LIFF ID. Run `node --test deployment/line/four-menu.test.mjs` to verify the manifest. The committed Stage manifest contains public URLs only.

The member app reuses existing authentication, member, event and shop APIs. FAQ adds search and expandable answers. After successful authentication bootstrap, `memberRouteSync.ts` synchronizes React Router with the validated, restored deep link. No API, worker or database changes are needed for this release.

Build Stage member with `VITE_API_BASE_URL=https://api-stage.ucell.life/api/v1`, `VITE_LIFF_ID=2011813061-Qt3d2jmo` and `VITE_ENABLE_MOCK=false`; preserve the existing Google OIDC client ID. Production must use its own API base, Login/LIFF configuration and build values. Never put channel secrets or access tokens in Vite variables, manifests or source. Publishing uses the existing API application's Azure secret `line-channel-access-token` in memory only.

Deployment evidence is recorded in `stage-four-menu-evidence.json` and `stage-four-release-evidence.json`. The Stage menu is linked only to the authorized test LINE account; the OA-wide default menu is unchanged. Existing Messaging API webhook remains unchanged.

## Next actions only

- Confirm the four tiles on the physical LINE client by reopening the OA chat; server-side individual menu linkage is verified.
- Add and publish actual activities through the existing Admin event workflow. Stage currently has no activities, so the event page shows an empty state.
- At production cutover, generate a separate production manifest with the verified production LIFF ID and apply the production menu to the same OA. Do not promote Stage links as the default menu.
- Resolve the existing qualification-package authority validation error tracked by the Master Task; main-product browsing passes, qualification-package checkout is not UAT-approved.
