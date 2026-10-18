# Stage 上版結果 — 2026-10-14

本次 Stage 上版成功。API、Worker、Admin 均為 Healthy / Running；Production 未變更，會員前台維持原映像。部署來源固定於 C:/UCell/releases/recognition-stage-20261014，並以 source-manifest.json 的 SHA-256 清單追溯；API health 顯示的既存 release 字串不是本次未提交來源的完整識別，應以映像 digest 與來源清單為準。

## 上版內容

- 認列交易重試、HTTP 衝突回應、後台重複點擊與冪等處理。
- Worker 失敗退避、隔離及人工認列恢復資訊。
- 獎金成熟處理先排除已處理資料，避免積壓資料被前 500 筆阻塞。
- 保留 ERP 付款憑證號碼／備註欄位。

資料庫新增 bonus_award_source_event_type_idx 及 monthly_recognition_schedule 的 worker 恢復欄位／索引，遷移先於服務切換。遷移 execution ucell-stage-migrate-0rstw0q：Succeeded。沒有執行資料重置或植入年度模擬資料。

## 版本

| 服務 | Revision | 映像 digest |
| --- | --- | --- |
| API | ucell-stage-api--g8recognition20261014 | sha256:466af564544b54b356fb623eadc2f66a5105b4de0e1fca1b721ff248ec710eab |
| Worker | ucell-stage-worker--g8recognition20261014 | sha256:83e5fc84b8b34a8bed0290ea6edc534242e96b6e821a232b8597b144d415e97d |
| Admin | ucell-stage-admin--recognition-20261014 | sha256:f94220d696bea10e0bde9a781740a4d264f827991ada8aa73b9af3466921b6ae |

ACR 建置 ck2c、ck2d、ck2f 成功。本次 Admin 採 ck2f；初次 ck2e API base 缺 /api/v1，於部署前重建更正，沒有將 ck2e 部署。

## 驗證

- Stage preflight：31 assertions PASS。
- Admin 全套：269 PASS、0 FAIL。
- 部署前後端重點回歸：3 suites、31 PASS、0 FAIL，包含認列重試 DB／HTTP 及年度成熟積壓。另列 162 項資料庫基線斷言。
- API /api/v1/health HTTP 200，database=ok。
- Admin HTTP 200，新資產 /assets/index-hjPMIiZ1.js HTTP 200，API base 正確，含 workerBlocked／workerFailureCount 及 erpPaymentVoucher。
- 會員入口 HTTP 200，映像未變更。
- 專用本機測試隔離 DB 剩餘 0，容器已移除。

ERP 資產檢查初次誤用 erpPaymentReference，改為實際欄位 erpPaymentVoucher 後通過。未登入訂閱 GET 回應 200，經設定及程式核對為既有 Stage ADMIN_AUTH_BYPASS=true／SUPER_ADMIN 模式；未修改此設定，該回應不計入正式驗證登入或權限隔離通過。沒有以實際付款、認列寫入或銀行付款驗證 Stage。

## 證據與限制

- C:/UCell/releases/recognition-stage-20261014/stage-release.json：前後映像與健康結果。
- 同目錄 backend-release.json：遷移 execution 及 API／Worker digest；其 frontend=UNCHANGED 僅指後端子步驟，之後 Admin 已由外層部署更新。
- 同目錄 smoke.json、source-manifest.json、deploy-release.ps1、release-evidence-manifest.json。
- C:/UCell/logs/stage-20261014-deploy.log、stage-20261014-backend-gate.json、stage-20261014-admin-tests.json。

本次上版與部署驗證完成，不等同完整制度、年度承接與正式 10／25 日曆的驗收全部完成。保留前版 digest 作為回復依据；本次沒有觸發服務回復。
