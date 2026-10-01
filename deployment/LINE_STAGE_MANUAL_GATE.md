# Stage LINE manual gate

OA: **@258vmvsa**. Provider: **宇生國際股份有限公司**. Complete these steps only after the release health checks pass. Stop before real UAT until the operator confirms completion.

1. In the Messaging API channel's Basic settings, reissue Channel Secret. Do not reuse the previously exposed value.
2. In `rg-ucell-stage` → `ucell-stage-api`, create/update secret `line-channel-secret`, then bind environment variable **LINE_CHANNEL_SECRET** to that secret reference. Do not put its literal value in code, screenshots, Git or this report.
3. Issue a Messaging API Channel Access Token.
4. Store it as `line-channel-access-token` and bind **LINE_CHANNEL_ACCESS_TOKEN** on the API and existing worker where outbound sending is needed. Do not enable unrequested outbound campaigns.
5. Create/restart the required revisions after secret changes; confirm healthy revisions. Keep `LINE_MESSAGING_WORKER_ENABLED=true` on the worker for metadata processing.
6. Set LINE Developers Webhook URL to **https://api-stage.ucell.life/api/line/webhook**.
7. Click **Verify**. It sends a signed empty `events` array; expect HTTP 200. Until the secret is configured, HTTP 503 is intentional.
8. Enable **Use webhook** (and redelivery if desired; event identities are deduplicated).
9. Disable or adjust conflicting OA automatic replies as appropriate.
10. Use a phone to follow/message **@258vmvsa**, including text. Check metadata processing; message text and raw LINE subject are never stored by this ingress. No auto-reply is promised.

## LINE Login configuration (separate from Messaging API)

Existing code uses LIFF ID-token exchange, server verification against `LINE_LOGIN_CHANNEL_ID`, existing IdentityLink and a UCell session. Display name and frontend member ID are not authentication proof. Existing member linking requires company-approved proof and a verified LINE token; recovery/rebinding revokes old sessions and requires an approved one-use recovery flow.

Create/use the **LINE Login channel in the same Provider** and its LIFF app. Enable `openid` and the required profile scope; set LIFF endpoint to `https://stage.ucell.life`. Set backend **LINE_LOGIN_CHANNEL_ID** and build Member with **VITE_LIFF_ID** (`-LineLoginChannelId` / `-LiffId` on the incremental script). GitHub Stage inputs are `STAGE_LINE_LOGIN_CHANNEL_ID` and `STAGE_LIFF_ID`. Messaging Channel ID is not a substitute for Login Channel ID. These two public IDs were not present in the Stage API audit and must be supplied by the operator. Actual login/binding verification remains pending.

Official references: [raw-body signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) and [LIFF app registration](https://developers.line.biz/en/docs/liff/registering-liff-apps/).

After human confirmation, UAT covers LINE → login/binding → Member → products/order → PV/BV → sponsor/placement → qualification → bonus/wallet → Admin verification → return/reversal/audit. ERP and real bank payments are excluded. Rich Menu is optional and does not block this gate.
