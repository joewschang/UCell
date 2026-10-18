# 正式登入與 DNS 準備 — 2026-10-14

使用者已確認首位正式 Super Admin 為 joewschang@gmail.com，使用 Microsoft 登入，並可代為設定 Cloudflare DNS。

## 已執行

- 建立獨立 Entra 應用 UCell Production Admin：client ID 0dd08c48-b6e9-4b19-b67a-d3de401f9092；單一租戶 2ed64e97-b7a4-4627-ac8b-44e2b95cef3b；SPA 回呼 https://admin.ucell.life/login。
- Azure 已登入使用者為 joewschang_gmail.com#EXT#@joewschanggmail.onmicrosoft.com，物件 ID 25ecd876-6756-46fe-83c8-2a7437e96acc，與使用者確認身分相符。
- 正式空資料庫所有 migrations 成功。依已確認身分建立 Person、Entra IdentityLink、SUPER_ADMIN AdminAccessGrant 與初始化稽核事件；未建立會員資格、訂單或模擬帳本。
- 初始化採暫時單一 IP 資料庫防火牆，程序結束已刪除。應用程式資料庫防火牆另依 Azure 回傳 outboundIpAddresses 部署，狀態以 ucell-production-egress-20261014 deployment 為準，不使用 AllowAzureServices 全域規則。
- 正式 admin／member 映像建置成功（ACR ck2、ck3），建立 ucell-prod-admin、ucell-prod-member、ucell-prod-api。
- API 使用 Key Vault 密鑰引用及正式登入設定，ADMIN_AUTH_BYPASS=false、NODE_ENV=production、SWAGGER_ENABLED=false。工作負載身分只取得該 Key Vault Secrets User。
- 三個服務的外部 ingress 目前有 DeploymentValidation 單一 IP Allow 規則，尚未開放一般使用者。
- 瀏覽器驗證正式 Admin 預設 Azure 網址 HTTP 200，Microsoft 登入按鈕可見，DEV 按鈕數量 0。實際 Microsoft 登入待正式 DNS／TLS 後驗證。

## Cloudflare 記錄

TTL Auto；CNAME 全部 DNS only／灰雲。若同名既存記錄指向其他服務，先核對而非覆蓋。

| 類型 | 名稱 | 內容 |
| --- | --- | --- |
| CNAME | member | ucell-prod-member.orangepond-b428c382.eastasia.azurecontainerapps.io |
| CNAME | admin | ucell-prod-admin.orangepond-b428c382.eastasia.azurecontainerapps.io |
| CNAME | api | ucell-prod-api.orangepond-b428c382.eastasia.azurecontainerapps.io |
| TXT | asuid.member | 5287F2DB4D6214240497AE803F16EB08D4E1E5560561375E7F664797B580FE17 |
| TXT | asuid.admin | 5287F2DB4D6214240497AE803F16EB08D4E1E5560561375E7F664797B580FE17 |
| TXT | asuid.api | 5287F2DB4D6214240497AE803F16EB08D4E1E5560561375E7F664797B580FE17 |

## 待續

收到 DNS 完成後核對公開解析、加入自訂網域及 managed TLS，確認正式登入及 API 未登入 401；先核對資料庫 egress deployment 與 API DB health。正式 Worker、庫存配置、會員 provider、27 項正式 UAT 證據、備份還原及最終開放一般流量仍待完成。不宣稱正式營運已上線。

## 執行問題與證據

首次資料庫 firewall CLI 參數錯誤，未完成寫入；更正 server-name／name 後成功。會員首次建置 ck1 因 ACR classic builder 不支援 BuildKit secret mount 失敗，新增 Dockerfile.member.production，固定關閉測試會員入口後 ck3 成功。未改制度邏輯。

證據目錄 C:/UCell/releases/production-20261014：admin-bootstrap-result.json、admin-app.json、member-app.json、api-app.json、dns-targets.json、cloudflare-records.json、admin-ui-precheck.json、admin-login-precheck.png、database-egress.json、production-build-addendum.json。資料庫遷移記錄：C:/UCell/logs/production-migration-20261014.log。正式密鑰不包含於報告。
