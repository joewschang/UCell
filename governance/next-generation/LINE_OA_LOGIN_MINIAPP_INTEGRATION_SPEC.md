# UCell × LINE 前後台整合規格 v1.0

**狀態：** APPROVED FOR IMPLEMENTATION  
**日期：** 2026-09-24  
**範圍：** LINE Official Account / Messaging API / LINE Login / LIFF or LINE MINI App / Member Web / Backend / Admin  
**原則：** LINE 負責入口、身分與溝通；UCell 是 Person、memberNo、Ball、組織、訂單、獎金與權限 SSOT。

## 1. 系統邊界

### LINE OA
- 加好友、Rich Menu、客服入口、重要通知、公告。
- 不保存 UCell 會員資格、Ball、PV/BV、獎金或正式權限真源。

### LINE Login / LIFF / MINI App
- 提供 LINE 身分驗證與在 LINE 內開啟 UCell Member。
- Client 只能把 LINE token 送到 UCell Backend；不得把 client 取得的 userId/profile 當作伺服器登入依據。

### UCell Backend
- 驗證 LINE ID token/access context。
- ExternalIdentityBinding: LINE subject ↔ Person。
- Person/memberNo/1:N Balls、RBAC/BOLA、訂單、獎金、通知 SSOT。
- Messaging webhook 驗簽、去重、入列、非同步處理。

### Admin
- Person 360 查看 LINE binding 狀態、綁定歷史與安全處置。
- 不顯示 LINE access token / ID token / channel secret。
- 沿用 LINE_ACCOUNT_SECURITY_LITE_SPEC.md 的安全鎖定與重新綁定流程。

## 2. 環境隔離

Stage 與 Production 必須使用不同 LINE resources/secrets：
- OA / Messaging API channel
- LINE Login / MINI App or LIFF ID
- Channel ID / Channel Secret / Channel Access Token
- Callback/Endpoint URL
- Webhook URL

不得共用 Stage/Production secret。Production 不得接受 Stage UAT query identity/bypass。

## 3. Provider / Channel

正式資源應由 UCell 營運公司控制，同一品牌下需要互通的 OA/Messaging API/Login/MINI App 應依 LINE Provider 設計放在正確 Provider。正式建立前確認公司 ownership 與管理員名單。

## 4. Member Login

流程：
1. 使用者由 OA Rich Menu 或外部網址進 UCell Member。
2. LIFF/MINI App 初始化。
3. 未登入 LINE 時走 LINE Login。
4. Client 取得 ID token。
5. Client 將 token 送至 UCell Backend auth endpoint。
6. Backend server-side 驗證 token 的 signature/issuer/audience/expiry/nonce 等適用欄位。
7. Backend 取得 verified LINE subject。
8. 依 ExternalIdentityBinding 找 Person。
9. 若 binding ACTIVE 且 Person 非 SECURITY_LOCKED，建立 UCell Member session。
10. 載入 memberNo 與 authorized Balls。
11. 若未綁定，進 Account Linking，而不是自動建立正式會員。

禁止：client 傳 userId/displayName 後 Backend 直接信任。

## 5. Account Linking

既有會員第一次 LINE 登入：
- verified LINE subject 尚無 ACTIVE binding；
- 顯示「綁定既有會員」；
- 以 memberNo + 公司核准的身分驗證流程完成綁定；
- binding 成功後才建立正式 Member session。

非會員：
- 不因加入 OA 或 LINE Login 自動成為會員；
- 導向了解會員方案/加入會員/推薦關係流程。

同一 LINE subject 不得同時 ACTIVE 綁多 Person；同一 Person 同時間最多一個 ACTIVE LINE binding（除非未來另有正式多身份規格）。

## 6. Member Frontend / LIFF

保持既有 Experience v2 五大 IA：
- 首頁
- 組織
- 收益
- 商城
- 我的

OA Rich Menu 建議六格：
- 我的 UCell → Member Home
- 我的組織 → Organization
- 我的收益 → Earnings
- 會員商城 → Shop
- 訂單查詢 → Orders
- 客服中心 → Support

Rich Menu 是入口，不重做第二套會員系統。

Member privacy 延續既有規則：
- Reservoir A/B zero disclosure；
- 每棵 Tree bootstrap Position 1–3 不呈現；
- 非直推 visible Ball 不呈現 holder PII；
- 正常 UI 使用 memberNo/ballNo，不使用 UUID 作主要識別。

## 7. Messaging API Webhook

建議 endpoint：
POST /api/v1/integrations/line/messaging/webhook

處理順序：
1. 取得 raw UTF-8 request body，不先 parse/format。
2. 讀取 x-line-signature。
3. 使用該環境 Messaging API Channel Secret 做 HMAC-SHA256 signature verification。
4. 驗簽失敗立即拒絕，不處理 event。
5. 驗簽成功後 parse events。
6. 以 webhookEventId 或可用的 LINE event identity 做 idempotency/dedup。
7. Persist minimal event envelope / enqueue。
8. 快速回 200。
9. Worker 非同步處理 follow/message/postback 等核准事件。

Webhook endpoint 不以 source IP allowlist 取代 signature verification。

## 8. Messaging Outbound

UCell Core 不直接呼叫 LINE。

流程：
Business Event → Transactional Outbox → Notification Worker → LINE Adapter → Messaging API。

第一版通知：
- 首次綁定成功
- 訂單成立（可配置）
- 商品已出貨/物流資訊
- 退貨完成
- Settlement 完成
- Payout 完成
- Active 即將失效
- LINE rebind 完成
- 銀行帳戶異動完成
- 重大系統/會員公告

避免：每次 PV/BV、每個 Pair、每個下線加入、每筆 Ledger 都 push。

Notification 必須有：
- templateKey/version
- personId/internal target
- LINE binding resolved at send time
- delivery status
- provider message/request correlation
- retry policy
- failure reason
- created/sent timestamps

不得 log access token 或完整敏感 payload。

## 9. LINE Adapter

建立 provider abstraction，不讓 Core 綁 LINE SDK：
- verifyIdToken()
- resolveVerifiedSubject()
- pushMessage()
- replyMessage()
- validateWebhookSignature()
- normalizeWebhookEvent()

未來 AI/其他通知渠道不改 Core。

## 10. Admin LINE Integration

Person 360 增加「LINE / 身分」區：
- 綁定狀態 ACTIVE/REVOKED/UNBOUND
- 最後綁定/驗證時間
- 安全狀態 NORMAL/SECURITY_LOCKED
- 最近 Member session（依 RBAC）
- 綁定歷史
- 安全鎖定
- 撤銷 Member sessions
- 建立 LINE rebind request
- 安全異動 Audit

不得提供「直接手填 LINE subject 強制換綁」的一般操作。

另建最小 LINE Operations 頁（若現有 Integrations 頁可承接則沿用）：
- Environment
- Messaging webhook health / last received
- outbound notification queue summary
- failed delivery summary
- Login/MINI App configuration readiness（只顯示 configured/not configured，不回傳 secret）
- Verify/diagnostic status
- Stage/Production badge

## 11. Secrets

Secrets 只存在環境 secret store（Stage 建議 Azure Key Vault/Container Apps secret reference）：
- LINE_LOGIN_CHANNEL_ID
- LINE_LOGIN_CHANNEL_SECRET（如 server flow 需要）
- LINE_MESSAGING_CHANNEL_SECRET
- LINE_MESSAGING_CHANNEL_ACCESS_TOKEN or stateless-token credentials
- LINE_LIFF_ID / MINI_APP_ID
- callback/endpoint config

不得 commit .env secret；不得經 Admin API 回傳 secret；log 必須 redact。

## 12. API 建議

依既有 naming convention 調整：
- POST /api/v1/member/auth/line
- POST /api/v1/member/auth/line/link
- GET /api/v1/member/auth/line/status
- POST /api/v1/integrations/line/messaging/webhook
- GET /api/v1/admin/integrations/line/status
- GET /api/v1/admin/persons/{id}/line-bindings

LINE rebind API 沿用 LINE_ACCOUNT_SECURITY_LITE_SPEC.md，不建立第二套 recovery。

## 13. Session

LINE token 驗證成功後，UCell 建立自己的 Member session。後續 UCell API authorization 以 UCell session + Person/Ball authorization 為準，不要求每個 API request 都直接信任 client-side LINE profile。

SECURITY_LOCKED / revoked binding / disabled member 必須 fail closed；session revoke 應立即生效。

## 14. Webhook / Notification Reliability

- webhook signature before JSON mutation；
- async processing；
- duplicate event safe；
- outbound retry with bounded backoff；
- provider 4xx 不無限重試；
- provider 429/5xx 依 policy retry；
- dead-letter/failed state 可由 Admin 查看；
- correlationId 串起 business event/outbox/provider call；
- 不因 LINE 發送失敗 rollback 已完成的 Order/Settlement business transaction。

## 15. OA UX / Content

歡迎訊息簡潔：
- 歡迎加入 UCell
- 進入會員中心
- 查看訂單
- 聯絡客服

客服第一版：真人客服 + FAQ + 快捷回覆；AI 客服另案，且未來只能使用 Member-safe tools。

Rich Menu 與 Member Experience v2 使用一致 UCell 品牌與 terminology。

## 16. Security

必測：
- forged/tampered ID token denied
- expired/wrong audience token denied
- client-forged userId/profile cannot impersonate
- webhook missing/invalid signature denied
- raw-body signature validation
- duplicate webhook idempotent
- subject bound to another Person fail closed
- SECURITY_LOCKED cannot login
- revoked binding cannot login
- session revoke effective immediately
- BOLA/IDOR across Person/Ball
- Member Reservoir/bootstrap/PII rules unchanged
- secrets absent from logs/OpenAPI examples/API responses
- Stage credentials cannot authenticate Production and vice versa

## 17. OpenAPI / Audit

新增/修改 endpoints 必須 OpenAPI regenerate/validate/diff。Webhook schema 可記錄 LINE event envelope，但不要把 secrets/token 放 example。

Audit：
- LINE_LOGIN_SUCCESS/FAIL（避免過度敏感資料）
- LINE_BINDING_CREATED/REVOKED
- MEMBER_SESSION_CREATED/REVOKED
- LINE_WEBHOOK_SIGNATURE_REJECTED（security event）
- LINE_NOTIFICATION_SENT/FAILED（營運 event）

## 18. Stage UAT

Stage 正式 connected UAT：
1. Stage OA / Login / MINI App credentials configured。
2. 5–10 名公司測試者加入 Stage OA。
3. 測首次登入/綁定、多 Ball、Inactive、Security Lock、rebind。
4. 測 Rich Menu 六入口。
5. 測 Order → shipment notification（可用 synthetic ERP/status event）。
6. 測 webhook signature / duplicate / retry。
7. 測 Member privacy。
8. temporary isolated UAT access 僅在既有明確隔離條件下使用，正式 LINE connected UAT 完成後應依治理決定關閉，不得進 Production。

## 19. Production Gate

Production 前至少：
- Production LINE resources 與 Stage 分離；
- callback/webhook 使用正式 HTTPS domain；
- secrets 正確配置；
- LINE connected Security E2E PASS；
- account linking/rebind PASS；
- OA Rich Menu/notification UAT PASS；
- privacy/BOLA PASS；
- monitoring/runbook 完成；
- no auth bypass。

## 20. 不在本工作包

- AI客服/RAG
- Passkey/MFA/Risk Engine
- ERP integration
- LINE Pay
- 複雜行銷 automation
- 重新設計 Bonus/Tree/Person core
