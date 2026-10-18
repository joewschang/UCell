# Stage Super Admin 入口修復 — 2026-10-14

原因：前一版 Admin 建置漏設 VITE_STAGE_UAT_DEMO_LOGIN=true，前端隱藏 DEV：Super Admin 入口；後端 Stage bypass 仍啟用。前次僅檢查 API 設定，未驗證前端入口，漏失此問題。

已用同一份固定來源重建並部署 Admin，明確設定 VITE_STAGE_UAT_DEMO_LOGIN=true 與 VITE_ENABLE_DEMO_LOGIN=true。保留 API base 與 Entra 設定。API、Worker、資料庫未變更。

- 建置：ck2g，Succeeded。
- Revision：ucell-stage-admin--superadmin-20261014。
- 映像：ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-admin@sha256:3c2471aab5b62da3d59d74287f5a24e6e8c2f7543da1ec33901dd7d6e446f62d。
- 狀態：Healthy / Running。
- 以無既存登入資料的 Edge headless 瀏覽器開啟 /login，確認 DEV：Super Admin 按鈕可見，實際點擊後進入 /，並確認 SUPER_ADMIN 登入狀態。未執行業務寫入。
- 證據：C:/UCell/releases/recognition-stage-20261014/superadmin-browser-verification.json、superadmin-entry.png、superadmin-dashboard.png、superadmin-release.json。

本修復取代 STAGE_RELEASE_20261014.md 的 Admin revision；先前 API／Worker revision 維持不變。既有 Stage 測試登入不是正式 Entra 身分驗證。
