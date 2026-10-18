# EVERY8D SMS — Stage 接線與啟用 Gate

更新：2026-10-08。Stage migration 與 API／Member／Admin 部署已完成，三個 revision 均為 `--sms-20261008`，Healthy／Running。手機驗證、SMS 登入與通知旗標已啟用。映像 digest、部署前版本及驗證結果見同目錄 stage-*.json；來源快照 C:/UCell/releases/sms-stage-20261008。

## 供應商狀態

依 EVERY8D 官方 API2.1 v2.2 文件，標準企業平台使用 HTTPS POST：

- `https://new.e8d.tw/API21/HTTP/GetCredit.ashx`：不發送簡訊的帳號／額度檢查。
- `https://new.e8d.tw/API21/HTTP/SendSMS.ashx`：發送簡訊。
- 若合約使用客製平台，須使用 EVERY8D 業務確認的 SiteURL，不能猜測。
- 官方文件入口：https://www.teamplus.tech/product/every8d-download/

更新後帳密已於 2026-10-08 通過標準平台 GetCredit 查詢，當時可用額度 1000.00 點。已儲存至 Stage API Azure Secrets。使用者指定測試門號後，2026-10-08 17:03（台北）已提交一則 UCell 測試簡訊至 0980***846，扣 1 點、餘額 999.00；batch `f8677e56-96a0-4341-98ac-0608534aaa87`。首次 DR 查詢為 0；使用者已確認手機成功收件。此為供應商收件測試，不等於會員手機已完成 OTP 驗證。先前 -101 認證問題已解除；本文件及 source code 均不存帳密。

## Azure 設定對照

以下設定僅套用至 `ucell-stage-api`。EVERY8D Secrets 已建立，部署使用下列 secretref；Stage SMS 功能旗標已啟用；會員實際 OTP 流程仍待本人登入驗收。

| Azure Container App Secret | API Environment Variable | 設定 |
| --- | --- | --- |
| `every8d-uid` | `EVERY8D_UID` | `secretref:every8d-uid`，已驗證的 API 帳號 |
| `every8d-password` | `EVERY8D_PASSWORD` | `secretref:every8d-password`，已驗證的 API 密碼 |
| `contact-otp-hash-secret` | `OTP_HASH_SECRET` | 沿用既有 secretref，至少 32 字元；不得因本次部署任意輪替 |
| 不適用 | `EVERY8D_SMS_ENDPOINT` | 上述 SendSMS HTTPS URL 或業務確認的客製端點 |
| 不適用 | `CONTACT_VERIFICATION_SMS_REQUIRED` | Stage 已設 `true`，要求註冊／手機變更完成驗證 |
| 不適用 | `AUTH_MEMBER_SMS_LOGIN_ENABLED` | 預設 `false`；Stage 已設 `true` |
| 不適用 | `SMS_NOTIFICATIONS_ENABLED` | 預設 `false`；Stage 已設 `true`，API 仍強制真正管理員 session |
| 不適用 | `SMS_OTP_DAILY_LIMIT` | 預設 `200`，全站滾動 24 小時 challenge 上限，包含無法寄送的登入請求 |
| 不適用 | `SMS_NOTIFICATION_DAILY_LIMIT` | 預設 `500`，滾動 24 小時已保留／已受理／結果不明的通知收件數上限 |
| 不適用 | `AUTH_CHANNEL_ENABLE_SMS_OTP` | 舊流程保持關閉；本次不使用舊登入端點 |

上限計算的是請求／收件數，並非供應商扣點金額；長簡訊可能分段計費。請在 EVERY8D 平台另設合適的額度管理。

`ucell-stage-member`：部署新增簡訊登入介面，沿用既有 Stage API URL；不放 EVERY8D 帳密。手機驗證沿用既有個人資料及註冊驗證流程。

Stage Admin：部署 `/sms` 簡訊通知頁，沿用 API URL／管理員 session；不放 EVERY8D 帳密。

Worker：本次同步提交由 API 處理，不需要帳密、環境變數或部署變更。

Production：使用獨立 App Secret 與環境設定。即使供應商共用帳號，也不能複製 Stage 功能旗標直接啟用；需獨立驗收額度與送達。LINE OA／Webhook 不受本次變更影響。

## 行為與介面

所有 API 路徑加上既有 `/api/v1` prefix：

- `GET /auth/member/sms/policy`：功能開關。
- `POST /auth/member/sms/challenges`：`{mobile}` + UUID `Idempotency-Key`。所有手機回覆相同接受格式；只寄送至唯一對應、正常有效且已驗證手機的會員。
- `POST /auth/member/sms/login`：`{mobile,challengeId,code}`。後端驗證、鎖定並一次性消耗 proof，核發既有 MEMBER_LOCAL session；不接收 member_id，也不建立／改綁會員。
- `GET /admin/sms/campaigns`：最近 50 筆，手機遮罩。
- `POST /admin/sms/campaigns`：建立草稿及收件快照，`{message,memberNos}` 或 `{message,allVerified:true}` + UUID `Idempotency-Key`。
- `POST /admin/sms/campaigns/:id/send`：使用預覽回傳 `contentHash`、`recipientCount` 確認提交。再檢查會員及手機驗證狀態，避免預覽後異動仍發送。

OTP：有效 5 分鐘、重送間隔 60 秒、每門號每小時 5 次／每日 10 次、每主體每日 20 次、錯誤 5 次鎖定。資料庫只存 HMAC 驗證碼／proof，不記錄明碼驗證碼。

通知：單批 1–500 人，只發送至手機已驗證的有效會員，同門號去重。支援個別會員或多位會員；自動加上【UCell】，總長最多 300 字。草稿 30 分鐘到期，建立與發送留下 audit。後端要求真正的 ADMIN_LOCAL 或 ENTRA bearer session，角色限 SUPER_ADMIN／MEMBERSHIP_OPS；Stage DEV_BYPASS 不可付費發送。

`SUBMITTED` 僅表示供應商受理，並非送達。逾時或不完整回覆記為 `UNKNOWN`，不得自動重送；程序中斷可能留下 `SENDING`，須依時間／內容到 EVERY8D 查詢再人工處理。此次不含自動電信送達回報同步。

## Migration 與驗證證據

先依既有部署流程套用 `20261008090000_sms_login_notifications`（LOGIN challenge purpose 及 `integration.sms_campaign`），再部署 API／Member／Admin。功能先保持關閉，不能在資料庫未遷移時啟用。

已通過完整隔離 PostgreSQL migration、162 項既有 DB assertions、216 組 1537 項 API 測試。Member 全部 271 項通過，文字調整後 6 項相關測試通過。Admin 全套 242 項中 241 項先通過；新增 /sms 導覽的預期值修正後，該檔 5 項全部通過。涵蓋並行登入只核發一次、未驗證／重複手機拒絕登入、鎖定會員、通知並行去重、收件資料變更、未知結果不重送、DEV_BYPASS 拒絕、每日上限的冪等重試。上述自動化測試的供應商呼叫均 mock；另一次本人指定手機的供應商實際收件測試扣 1 點。

## NEXT ACTIONS ONLY

1. 使用者在已開啟的 Stage 頁面登入原本的 LINE／Google 會員。以指定手機完成資料頁 OTP 驗證，再登出測試 SMS 登入；本輪最多 3 則的額度已用 1 則，剩餘 2 則可供此驗收。
2. 真正管理員登入後驗收 /sms 收件預覽與操作紀錄。實際通知發送需在剩餘授權範圍內進行；不可用 DEV_BYPASS 或任意會員測試，也不可超出本輪 3 則。

已部署的線上檢查：health 200、SMS policy enabled=true、contact policy smsRequired=true、無 bearer 的 admin/sms/campaigns 回覆 401、無效 SMS 登入資料回覆 400、Member/Admin 靜態資源包含新介面。尚未宣稱真實會員 OTP 登入或真正管理員發送已完成。