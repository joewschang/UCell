# 正式上線前置檢查 — 2026-10-14

使用者已明確授權執行正式上線，並允許使用 Chrome joewschang@gmail.com 工作階段。授權已取得；目前尚未部署或切換正式流量。

## 已查證

- Azure CLI 可用的已登入訂閱：Azure subscription 1（563f9d83-30f0-48db-b3ec-297a2e3d0345）。目前列出的唯一資源群組為 rg-ucell-stage。這不代表其他帳號或其他平台沒有正式機。
- 正式環境範本列會員 app.ucell.life、管理 admin.ucell.life、API api.ucell.life；尚未確認使用者實際正式目標與網域。
- test-todo-gate：PASS。
- uat-gate：UAT_P0_FAIL，UAT-R6-001 至 021 仍標記 NOT_RUN。此為驗收紀錄未完成，不能直接解讀為 21 項功能實際失敗，也不能用其他套件測試數字代替。
- backend/release/R6_RELEASE_GATE.json 仍為 PRE_PRODUCTION，要求 P0、安全、資料庫、備份等 gate 完成。需以本次來源核對證據，不直接沿用過期報告。
- 現有 Azure 自動部署腳本是 Stage 專用，含固定 Stage app/job 名稱及 NODE_ENV=staging，不能只換資源群組名稱就用於正式機。
- Chrome 操作工具初始化失敗（failed to write kernel assets / 系統找不到指定的路徑）；沒有讀取或搬移瀏覽器 cookie、密碼或登入 token。

## 待補資料與執行順序

1. 確認既有正式主機／訂閱／資源群組；若不存在，確認使用目前 Azure 訂閱建立獨立正式環境及正式會員網域。
2. 盤點正式資料庫是否已有資料，選定保留資料的遷移方案與备份／隔離還原驗證；不把 Stage 測試帳本移入正式資料庫。
3. 逐案補齊 UAT 證據與同版發布檢查，驗證正式管理者授權及會員登入回呼、服務憑證、監控與恢復能力。
4. 以固定來源建立正式前端映像，使用正式 API base；NODE_ENV=production、ADMIN_AUTH_BYPASS=false、VITE_ENABLE_DEMO_LOGIN=false、VITE_STAGE_UAT_DEMO_LOGIN=false。不得使用剛修復的 Stage Super Admin 測試映像作正式登入。
5. 在確定目標上準備可回復部署，先驗證備份與遷移，再更新服務、驗證正式身分登入／健康／功能，最後切換正式網域流量並保存 digest 及證據。

## 證據

- C:/UCell/logs/production-20261014-todo-gate.log
- C:/UCell/logs/production-20261014-uat-gate.log
- .github/workflows/rc-promotion.yml
- backend/release/R6_RELEASE_GATE.json
- deployment/.env.production.example

Stage 保持原狀；沒有修改正式 DNS、建立新雲端資源、關閉 release gate 或將未執行項目改為 PASS。
