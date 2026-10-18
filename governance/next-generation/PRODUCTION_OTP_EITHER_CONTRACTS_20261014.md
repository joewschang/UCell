# 正式註冊驗證擇一與合約更新

使用者要求啟用手機與 Email 驗證碼，註冊任選一項完成即可；並確認一般會員採適用的一般會員條款與個資告知，升級正式會員才簽完整協議。

## 實作與部署

- CONTACT_REGISTRATION_VERIFICATION_MODE=EITHER。LINE 網路會員及 Web 註冊均使用同一後端驗證方法；至少一份有效、同一身分／用途／聯絡方式、未使用且未過期的 proof 才可完成註冊。
- 有提交的 proof 均須有效；未驗證聯絡方式之 verifiedAt 保持 null。個人資料修改仍要求對應聯絡方式驗證，沒有放寬成可用手機 proof 修改 Email。
- 保留五分鐘期限、六位隨機碼、HMAC、五次錯誤限制、60 秒重送冷卻、持久化發送額度及防重複使用。
- 正式 Key Vault 接入既有 EVERY8D 與 Microsoft 365 provider credentials，另產生正式獨立 OTP hash secret。密鑰未寫入報告。啟用 SMS OTP flag，前端不含 provider 憑證。
- API ACR ck6；digest sha256:4f5e7aadbf2201951af23630ae679917221bee70298602ca9cb9a93e7dc959d2；revision ucell-prod-api--0000002。
- Member ACR ck5；digest sha256:d15e357320f218b695b57489bbc087510a4f573b98e0602d5b6f56e8a6a6abda；revision ucell-prod-member--0000001。

## 合約

來源為已歸檔的 2026-10-14 公司文件。一般會員版本依原有擷取草案及使用者本次確認的適用範圍，移除 Stage 測試標示，保留原始個資告知與一般會員適用範圍說明。完整正式會員協議使用已歸檔內容及相同 content hash，未改寫實質條款。

- NETWORK_MEMBER：PRODUCTION-20261014；1a09db96-79d8-4bea-aaac-fe8198991a17。
- FORMAL_MEMBER：OFFICIAL-20261014；7809c75d-0153-40fb-a46c-ef61397f6fa5。
- 新增合約版本與發布稽核；舊同意證據保留，未自動替會員同意。合約不自動建立正式會員資格、收款或經營球位。

## 驗證與限制

- 隔離本機 PostgreSQL：19 項後端測試通過，另通過 162 項資料庫基準斷言。含 SMS-only、Email-only、無 proof 拒絕、跨身分拒絕、已使用 proof 拒絕及既有雙驗證流程。
- 前台 10 項測試通過，含兩種單獨驗證註冊與未驗證拒絕。
- 兩個 ACR build 成功；正式 API 回讀 registrationMode=EITHER，合約版本正確，health/database ok。
- 尚未以使用者手機／Email 實際完成收碼與送出註冊，不將 provider 設定或 mock 測試當作真實送達證明。未主動發送測試簡訊／信件。
- 測試初次遇到本機 PostgreSQL 未啟動及 esbuild 平台套件缺失；啟動既有隔離測試容器並使用既有 Windows esbuild 後完成測試。未使用正式資料庫跑測試。

證據：C:/UCell/logs/production-otp-tests-20261014.log；C:/UCell/releases/production-20261014/otp-provider-configured.json、production-contract-publication.json、otp-contract-live-check.json。發布用暫時資料庫防火牆已於 finally 移除。
