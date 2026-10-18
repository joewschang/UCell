# 正式環境建立紀錄 — 2026-10-14

使用者已授權新建正式環境，會員網域確定為 member.ucell.life。管理／API 規劃為 admin.ucell.life、api.ucell.life。Stage 維持原狀。

本輪 ARM foundation deployment 最終狀態：Succeeded。Key Vault 已核對三個獨立密鑰名稱存在：postgres-admin-password、pii-encryption-key、identity-match-hmac-secret（未讀出或公開密鑰值）。基礎設施建立成功，不等於應用程式正式上線。

## Azure 建置

- 訂閱：563f9d83-30f0-48db-b3ec-297a2e3d0345。
- 資源群組：rg-ucell-production，eastasia。
- ARM deployment：ucell-production-foundation-20261014。
- 基礎設施來源：infra/production/foundation.bicep，已通過 Bicep build。
- PostgreSQL：ucellprod-pg-m3z2zx4ohqyui，16，GeneralPurpose Standard_D2s_v3，64 GiB，35 天備份；單區、未啟用 HA／異地備份，不宣稱具備跨區容錯。
- 正式資料庫：ucell_production；新建空資料庫，不複製 Stage 帳本。未設定 AllowAzureServices 廣泛資料庫防火牆規則；需在服務建置時加入已核實的連線來源。
- Container Apps environment：ucellprod-cae-m3z2zx4ohqyui。
- ACR：ucellprodacrm3z2zx4ohqyui。
- Key Vault：ucellkvm3z2zx4ohqyui，90 天軟刪除並啟用 purge protection。
- 儲存：ucellstm3z2zx4ohqyui，私人 KYC container、LRS。
- 獨立工作負載身分、Log Analytics、Application Insights。

## 映像

已從 Stage 倉庫複製兩個已驗證的候選映像至正式 ACR，並核對 digest 相同，尚未啟動正式工作負載：

- ucell-backend:rc-20261014 — sha256:466af564544b54b356fb623eadc2f66a5105b4de0e1fca1b721ff248ec710eab。
- ucell-worker:rc-20261014 — sha256:83e5fc84b8b34a8bed0290ea6edc534242e96b6e821a232b8597b144d415e97d。

正式前端必須使用正式 API origin，關閉 Stage／Demo；不能直接使用 Stage Super Admin 前端映像。

## 尚未開放正式營運

基礎設施部署狀態以 deployment 輸出證據為準。正式服務、資料庫遷移、DNS／TLS、身分應用與回呼、首位 Super Admin 正式授權、第三方 provider 正式設定、倉庫初始配置、備份還原驗證及正式 UAT 尚未全部完成。

DNS 位於 Cloudflare。Chrome 工具即使重設後仍因 kernel assets 路徑錯誤無法初始化；沒有繞過工具讀取 Chrome cookie 或登入 token。已詢問使用者能否代為加入 DNS 記錄，以及第一位 Super Admin 是否為 joewschang@gmail.com 並使用 Microsoft 帳號登入。

## 檢查與證據

- 安全政策靜態檢查：SECURITY_POLICY_PREFLIGHT_PASS。
- 正式 UAT gate：21 項 P0 仍 NOT_RUN；另有 P1 紀錄待驗收，不修改成虛構 PASS。
- deployment/production-environment-20261014.json：正式非機密設定及待辦。
- C:/UCell/logs/production-foundation-20261014.json：編譯後 ARM template。
- C:/UCell/logs/production-foundation-result-20261014.json：最終部署成功及非機密資源輸出。
- C:/UCell/logs/production-database-status-20261014.json：資料庫狀態與備份設定。
- C:/UCell/logs/provision-production-foundation-20261014.ps1：部署程序，不含密鑰明文常數。
- 新產生密鑰以 Windows DPAPI 加密保存於工作目錄之外，未輸出至報告；Key Vault 寫入結果另行核對。
