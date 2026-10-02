# Stage LINE Login / LIFF 人工 Gate（2026-10-01 最新決議）

此清單屬於既有 UCell Stage Master Task。程式準備完成不代表整體真人 LINE UAT 通過。既有工作與已完成項目保留；Stage scoped release 已部署，不改 Production。

## 已完成基礎（不列回待辦）

使用者確認：Provider **宇生國際股份有限公司**、OA **@258vmvsa**；Webhook **https://api-stage.ucell.life/api/v1/integrations/line/webhook**，Developers Verify **SUCCESS**，Use webhook **ON**。此為使用者提供的完成證據，不是本次重新執行 Verify。不要更改 URL、重建 Messaging Channel 或重做 secret/Verify；本文件取代舊十步 webhook 設定清單。

## 2026-10-01 Console 已完成

經使用者明確同意協議及建立授權，已建立 **UCell Login - Stage**（Console 上限 20 字元），Channel ID **2011813061**，LIFF ID **2011813061-Qt3d2jmo**，入口 **https://liff.line.me/2011813061-Qt3d2jmo**。Endpoint / openid / Full / OA link 已核實；Developing，Joe Chang 為 Admin 可測試。此建置 Gate 已完成，不需重建。

## 人工設定參考（已完成項目不重做）

1. 在上述既有 Provider 下建立 **LINE Login** Channel，名稱 **UCell Member Login - Stage**，Application type 選 **Web app**。公司聯絡信箱、描述、隱私政策及使用條款填真實公司資料，不使用範例值。
2. Stage 保持 **Developing**；將 UAT 人員設為 Admin 或 Tester，且其 Developers 帳號連結實際測試 LINE。非測試角色不能使用 Developing Channel。發布給一般使用者是另一個人工決定。
3. 在 Login Channel 的 Basic settings 連結 OA **@258vmvsa**（若該欄位可設定）。不要在 Messaging API Channel 建立 LIFF。
4. Login Channel → LIFF → Add：名稱 **UCell Stage Member**、Size **Full**、Endpoint URL **https://stage.ucell.life/**、Scope **openid**。目前程式不使用 getProfile/getFriendship，故 profile 可選，非必要；不需要 email 或 chat_message.write。Add friend option 可設 On (normal)，Scan QR / Module mode 保持關閉。
5. 記錄平台實際產生的 **LINE Login Channel ID、LIFF ID、LIFF URL**。OA 會員中心入口使用該 LIFF URL；不要自行拼出假 LIFF ID。本次不自動變更 Rich Menu。
6. Callback URL：本實作為 LIFF SDK flow，**不需要自行設定後端 OAuth callback**；LINE Login tab 的一般 Web Login Callback URL 留空即可。SDK 的固定 `redirectUri` 是 **https://stage.ucell.life/**，由 LIFF Endpoint 範圍控制。**/api/v1/auth/member/line/exchange** 是 POST ID-token 驗證端點，不是 callback，Webhook 也不是 callback。不要把它們填入 Callback URL。
7. LINE 官方目前仍支援 Login Channel 的 LIFF，並建議未來新應用考慮 MINI App；本次依已決議架構使用 Login + LIFF，不另建 MINI App。MINI App 另有 Developing/Review/Published internal channels、Web app settings 及審查流程，不能混用其 ID。若 Console 實際禁止新增 LIFF，停下回報畫面與限制，勿自動改架構。

## Azure / 設定映射

| 設定來源 | Azure Secret 名稱 | Environment / build variable | 套用位置 |
|---|---|---|---|
| Login Channel ID（公開識別） | 不需要 Secret | `LINE_LOGIN_CHANNEL_ID` | `ucell-stage-api` runtime；更新後建立健康 revision |
| LIFF ID（公開識別） | 不需要 Secret | `VITE_LIFF_ID` | `ucell-stage-member` **build-time**；必須重建 image，僅改 Container App runtime env 無效 |
| Stage API URL | 不需要 Secret | `VITE_API_BASE_URL=https://api-stage.ucell.life/api/v1` | Member build-time |
| Stage API CSP origin | 不需要 Secret | Docker build arg `CSP_API_ORIGIN=https://api-stage.ucell.life` | Member image nginx config |
| Mock 開關 | 不需要 Secret | `VITE_ENABLE_MOCK=false` | Member build-time（Dockerfile 已設定） |
| Login Channel Secret | **本實作不需要、不新增 Azure Secret** | **無；程式未讀取 `LINE_LOGIN_CHANNEL_SECRET`** | SDK + 後端 ID-token verify 僅需要 Channel ID，沒有 server code exchange。Secret 留在 Developers 安全管理，不貼聊天、不放 frontend/source |
| 已完成 Messaging Secret / Access Token | 既有 `line-channel-secret` / `line-channel-access-token` | 既有 `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` | 保留既有配置，與 Login ID 不可混用 |

若未來經核准改為後端 authorization-code flow，才新增 API Secret `line-login-channel-secret` → `LINE_LOGIN_CHANNEL_SECRET`，並同時實作持久化單次 state/nonce、browser binding、code exchange 與固定 callback；該名稱現在只是未啟用的保留命名，不能聲稱設定後即生效。

**Worker 不需要任何新增 LINE Login/LIFF 設定**。Admin 不需要 Login Channel Secret。既有 Messaging Worker 維持原狀。

現有 incremental deploy 參數為 `-LineLoginChannelId` / `-LiffId`；GitHub Stage inputs 為 `STAGE_LINE_LOGIN_CHANNEL_ID` / `STAGE_LIFF_ID`。部署應保留既有 secret refs，使用真實 ID 配對；不要把 Login Channel ID 誤當 Messaging Channel ID，也不要從 LIFF ID 前綴推算 Channel ID。Stage 與未來 Production 各用獨立 Channel/LIFF/環境及建置產物，Production 不沿用 Stage 測試入口或 synthetic token。

## 登入及綁定安全邊界

`liff.login()` / `liff.init()` 處理 SDK 授權回跳，已安裝 SDK 2.31.0 的外部瀏覽器登入使用隨機 state 與 S256 PKCE。UCell 不自行接收 code 換 token，不以回跳 query/state 或 decoded profile 建立 session；SDK 初始化成功後才處理推薦網址。沒有自行發起 OIDC nonce 的 flow，後端也沒有假裝 nonce 已比對：目前 verify 使用官方 verify endpoint、Channel ID、issuer/audience/subject/iat/exp；若未來發起自訂 nonce，必須由伺服器保存並驗證，不接受前端宣稱的 expected nonce。

後端只以已驗證 `sub` 找 ACTIVE IdentityLink，會員須 EFFECTIVE/NORMAL，再發短效 UCell session；exchange 保留 token replay 防護。未綁定時前台可申請公司核驗，再使用公司透過核准管道提供的短效單次憑證完成綁定。輸入會員編號只是待審目標，不是擁有權證明；不能直接指定 member_id 或 LINE subject。completion 嚴格比對原申請 LINE subject，並重新檢查會員 EFFECTIVE/NORMAL。前台不儲存原始 ID token 或核准憑證。

既有 rebind service 需 security lock、核准及單次憑證、24 小時 cooldown；禁止佔用其他會員 subject，撤銷舊 binding/session。Unbind 是受權限控管的安全操作並撤銷 session；不新增公開任意解除/改綁 API。公司核驗與初次綁定憑證交付使用既有 Admin API/授權流程，不自動核准。Audit 另確認：rebind 的 approve/complete 目前只有內部 service，未暴露 HTTP controller；不將它宣稱為可供真人自助操作的完整流程，也不直接公開接受 newLineSubject 的內部方法。Stage 初次綁定不依賴此路徑；換綁維持拒絕並轉客服，未來若需啟用換綁完成入口，必須另接 server-verified token 與審核控制。

## NEXT ACTIONS ONLY

追加完成：使用者授權 Stage 必要調整後，以限定 Stage／固定會員／固定三個 ID 的 SYSTEM fixture runner 建立 **A000014、A000015、A000016** 三顆 LEADER 球。重用原有安置檢查及 tree writer，完整持有／方案／推薦／安置／稽核紀錄；未改 HTTP 身分驗證。原 STARTER 保留。真實 LINE 頁面已顯示三球且切換成功，A000014 左右各一球。已部署 ORM TEXT 型別修正及 retail-orders Promise 修正；既有 Stage 測試商品已補 ProductRuleProfile，商城可購買。證據見 `../governance/next-generation/evidence/line-three-leader-fixture-20261001.json`。不將無活躍期／無金流認列宣稱為 Active 或獎金 UAT 通過。

2026-10-01 已完成：Console 建立、OA 連結、Stage API/Member 部署、健康驗證，以及 Joe Chang 真實 LINE login/consent → Stage → 後端驗證 → 未綁定會員畫面。API/Member revision suffix 為 line-login-20261001，證據見 governance/next-generation/evidence/line-liff-console-20261001.json。這些已完成步驟不重做。

補充完成：使用者確認全為測試資料並授權選擇正式測試會員後，已使用既有 Stage 審核 API 與單次憑證完成 Joe Chang → **2609000001 / Stage UAT Member** 綁定；實際會員頁確認 **FORMAL_MEMBER**。測試授權參考為 `STAGE-UAT-USER-AUTH-20261001`，不代表正式公司 KYC 或 Production Admin 身分驗證。未新增會員或改綁其他 LINE；一次性憑證暫存已刪除。

已完成 PATCH CORS 部署（line-uat-cors-20261001，Healthy/Running）及真實 LINE 配送儲存／NT$4800待付款訂單。A000016 訂單歷程可見、A000015 無訂單，跨球隔離 PASS；無收款／出貨。

1. 循正常測試認列流程接續訂單後段；目前測試訂單為 PENDING／FULFILLMENT_PENDING，不能視為已付款或已出貨。
2. 追查完整二元樹的 snapshot recovery 錯誤；推薦關係與二元左右計數已通過。後續配置經核准的有效期套組並循正式服務驗證 Active／認列，不直接填造金流 ledger。
3. 資料及部署阻礙排除後接續真人 UAT：Products → Orders → PV/BV → Sponsor / Placement Tree → Qualification → Bonus → Wallet → Admin verification → Return / Reversal，包含異人/過期/重用憑證及撤銷隔離案例。Login → Member Binding → Member Center 已完成，不重做；整體 UAT 尚未通過。
4. 如新增測試人員，需指定真實帳號再授權 Tester；目前 Joe Chang 已為 Admin。Channel 維持 Developing。
5. 只修實際 findings；ERP / 正式銀行付款 OUT OF SCOPE。本機空間不足已用 ACR 雲端建置繞過，未清理任何既有成果。

官方依據（2026-10-01 查核）：[LIFF registration](https://developers.line.biz/en/docs/liff/registering-liff-apps/)、[SDK init/login](https://developers.line.biz/en/reference/liff/)、[server ID-token verification](https://developers.line.biz/en/docs/line-login/verify-id-token/)、[Developing/tester roles](https://developers.line.biz/en/docs/line-login/getting-started/)、[MINI App Console](https://developers.line.biz/en/docs/line-mini-app/discover/console-guide/)。
