# 正式 LINE 登入設定部署 — 2026-10-14

使用者在既有「宇生國際股份有限公司」Provider 建立 UCell Login Prod，Channel ID 2012021712，LIFF ID 2012021712-Dqh6Z8aq。截圖確認 LIFF 名稱 UCell Member、Full、endpoint https://member.ucell.life/、openid。使用者回覆已完成 Published 與官方帳號連結；此發布狀態屬使用者確認，未透過 Console 自動操作驗證。

## 部署

- API 加入 LINE_LOGIN_CHANNEL_ID=2012021712；revision ucell-prod-api--ojahie9 健康。
- 前台以正式 LIFF ID、https://api.ucell.life/api/v1 及正式 CSP origin 重建。ACR ck4 成功；image ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-member@sha256:cecb9ec0b57494bf3b4f72ef5816646a02f51b3574eb4c206de7a5c43cd1c8d3。
- Member revision ucell-prod-member--fjtpujd 健康，mock/demo 維持關閉。
- Dockerfile.member.production 增加缺少 VITE_LIFF_ID 時拒絕建置的檢查。
- 不使用、不保存 LINE Login Channel Secret；此流程使用官方 ID token 驗證端點與 Login Channel ID。

## 實測

2026-10-14T14:26:48Z，乾淨 Edge Playwright 工作階段：

- 原「LINE 登入尚未設定」訊息消失，顯示「使用 LINE 登入」。
- 正式 LIFF contextToken HTTP 200。
- 點擊登入後進入 https://access.line.me/oauth2/v2.1/login，HTTP 200。
- 無頁面 JavaScript 錯誤。
- API health HTTP 200、database ok。
- 無效 ID token 測試回傳 HTTP 401 / LINE_TOKEN_INVALID。

首次驗證碰到新舊 revision 切換而仍顯示舊錯誤；待新 revision 健康後重跑通過。

證據：C:/UCell/releases/production-20261014/line-login-check.json、line-login-configured.png、line-api-check.json。未完成使用者本人 LINE 登入後的正式會員綁定或註冊 UAT；正式 ingress 限制、Google/OTP 及其他上線驗收仍需另行處理。OA 目前四格仍為正式網站直接網址，不是 Stage LIFF。
