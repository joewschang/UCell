# 正式 LINE 登入設定

現況（2026-10-14）：正式會員網站缺少 build-time VITE_LIFF_ID，正式 API 缺少 LINE_LOGIN_CHANNEL_ID。會員初始化因此顯示「LINE 登入尚未設定」。選單網址改成正式網域不會自動建立這些設定。

## Console 設定

在 LINE Developers 的既有 Provider「宇生國際股份有限公司」下，建立或選擇獨立的正式 LINE Login Channel（建議名稱 UCell Login Prod，Web app）。使用公司的真實聯絡資料；關聯 OA @258vmvsa。保留 Stage Channel 2011813061 及其 LIFF 設定。

在正式 Channel 的 LIFF 頁新增應用程式：

- 名稱：UCell Member
- Size：Full
- Endpoint URL：https://member.ucell.life/
- Scope：openid（程式使用 getIDToken）
- 不需要 email 或 chat_message.write
- 一般會員使用前需完成該 Channel 的發布設定；Developing 狀態僅供獲授權角色測試

保存 Console 真正產生的 Login Channel ID、LIFF ID 和 LIFF URL。這些是公開識別碼。此實作不需提供 Channel Secret，也不把 Messaging Channel ID 當 Login Channel ID。

本應用使用 LIFF SDK 的登入流程；/api/v1/auth/member/line/exchange 是 POST ID-token 驗證端點，並非 OAuth callback 或 webhook。SDK redirectUri 為 https://member.ucell.life/，必須符合 LIFF endpoint。

## 取得設定後執行

1. 核對正式 Channel 與 LIFF endpoint/openid/發布狀態。
2. 用正式 LIFF ID 重建 deployment/Dockerfile.member.production，API base=https://api.ucell.life/api/v1，CSP origin=https://api.ucell.life；保留 mock/demo 關閉。
3. 更新 ucell-prod-api 的 LINE_LOGIN_CHANNEL_ID，等健康 revision；以新 immutable digest 更新 ucell-prod-member。
4. 驗證 LINE SDK 初始化、Microsoft 管理登入不受影響、LINE token exchange、會員綁定/註冊的實際流程。
5. 視登入入口需要將 OA 四格入口改為正式 LIFF URL 並保留各路徑，不能誤用 Stage LIFF。
6. 核對正式網路存取限制與上線驗收；不把兩個 ID 部署完成宣稱為完整會員 UAT 通過。

官方依據：https://developers.line.biz/en/docs/liff/registering-liff-apps/ 與 https://developers.line.biz/en/reference/liff/。
