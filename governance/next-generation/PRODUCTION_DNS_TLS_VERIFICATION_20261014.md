# 正式網域與 HTTPS 驗證 — 2026-10-14

本紀錄更新先前 PRODUCTION_DNS_IDENTITY_20261014.md 的 DNS/TLS 待辦；不代表正式營運驗收完成。

## 完成與證據

使用者匯入 Cloudflare DNS 後，公開解析確認 member/admin/api 三筆 CNAME 及三筆 asuid TXT 全數正確。三個 CNAME 直接指向各自 Azure Container App，DNS only。

三個正式網域均完成 Azure 受管理憑證簽發與 SniEnabled 綁定。保留 DeploymentValidation IP 規則，另加入 DigiCert 官方公布的 12 個 DCV IP /32 Allow 規則，以支援簽發與續期；未解除一般使用者流量限制。IP 清單可能改變，續期需維持符合 Azure 要求。

最終測試時間：2026-10-14T13:10:23Z 起。

| 檢查 | 結果 |
| --- | --- |
| https://member.ucell.life/login | HTTP 200、TLS 1.3、網域憑證驗證成功；LINE 尚未設定，會員登入不可用 |
| https://admin.ucell.life/login | HTTP 200、TLS 1.3、Microsoft 按鈕 1 個、DEV 按鈕 0 個、無頁面 JavaScript 錯誤 |
| Microsoft 授權導向 | 租戶 2ed64e97-b7a4-4627-ac8b-44e2b95cef3b；client 0dd08c48-b6e9-4b19-b67a-d3de401f9092；redirect https://admin.ucell.life/login，與正式設定一致 |
| https://api.ucell.life/api/v1/health | HTTP 200、status ok、database ok |
| 未登入管理 API | HTTP 401 |
| admin/member CORS preflight | HTTP 204，允許標頭精確對應正式來源 |
| 非信任來源 CORS preflight | 無 Access-Control-Allow-Origin 標頭 |
| 資料庫 egress deployment | Succeeded |

API health 的 release 顯示 UNVERSIONED；映像識別仍以部署的 immutable digest 為準。

## 限制與待辦

- Chrome 操作工具重試仍因 kernel assets 路徑錯誤失敗。僅驗證 Microsoft 授權導向，未完成使用者本人登入與 SUPER_ADMIN session 驗證。
- 正式 LINE/LIFF 設定尚缺；會員畫面明確顯示 LINE 登入尚未設定。
- Worker、庫存、正式 provider、完整 UAT、備份還原及最終開放一般流量仍待完成，cutover=false。
- 過程中 admin 設定遇到 Azure ContainerAppOperationInProgress；加入佈建等待後重試成功。首次前台檢查時 API 憑證未完成而 ECONNRESET；所有綁定完成後重跑成功。

證據目錄：C:/UCell/releases/production-20261014。檔案：dns-verified.json、managed-certificates-final.json、member-domain-binding.json、admin-domain-binding.json、api-domain-binding.json、custom-domain-check.json、member-custom-domain.png、admin-custom-domain.png、database-egress-status.json。執行腳本：bind-production-domains.ps1、verify-production-domains.cjs。

依據：https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-managed-certificates 與 https://knowledge.digicert.com/alerts/ip-address-domain-validation（2026-10-14 核對）。
