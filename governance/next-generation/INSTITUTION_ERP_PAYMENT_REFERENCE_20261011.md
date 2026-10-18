# 升級人工收款確認與 ERP 憑證參照

## 後續 Stage 發布：已完成

使用者明確要求更新 Stage 後，2026-10-11 13:57（台北）已部署 API 與 Admin 的 `erp-ref-20261011` revision，兩者 Healthy／Running、流量 100%。公開 API／資料庫健康檢查通過，後台 `/workflows` 及新 JS 檔案 HTTP 200，實際發布檔含 ERP 憑證欄位與全數收款確認文字。未操作真實資格核准作為線上驗證。

Stage 現有 Super Admin 為無 Person ID 的測試登入，因此追加嚴格限定 Stage 的相容分支：只有 UCELL_ENVIRONMENT=STAGE、NODE_ENV=staging、ADMIN_AUTH_BYPASS=true，且符合 guard 的 ADMIN_LOCAL／DEV_BYPASS／dev-bypass／SUPER_ADMIN 身分才接受。紀錄明示「Stage Super Admin（測試管理員）」、provider、subject 與 stageTestAdmin=true；不冒充具名管理員。正式環境、未啟用 bypass、錯誤角色與 subject 均拒絕。Stage 相容修改後 acceptance 為 **62 PASS／0 FAIL**；原具名管理員流程保留。

以目前部署的 API（sms-stage-20261008）及較新 Admin（admin-acceptance-fixes-20261010）各自驗證過 SHA-256 的來源快照為基底，僅覆蓋本功能 service、controller、後台 page 三個來源檔，避免整包發布工作區其他修改。ACR 建置 ck2a／ck2b 成功。無 DB migration；Member、Worker 版本未變，Production 未變。

- API digest：`sha256:758c7d62d2925d602b686c465fa6b709cbeb3ee19d81cb5187e64df653d0aa5b`
- Admin digest：`sha256:9c3ecbc5973973fdac438307387df66ae17c5750e006485979c7354db1a4ca77`
- 發布快照、before／after／smoke：`C:/UCell/releases/erp-reference-stage-20261011/`
- Stage 測試：`C:/UCell/logs/institution-erp-stage-acceptance-20261011.json`
- 本節之後保留原本機交付紀錄，當時「未部署」狀態由本節更新。

日期：2026-10-11。依使用者本次確認的簡化規格完成本機實作與驗證，未部署 Stage／Production。

## 本次規格

憑證與紙本由 ERP 管理，不上傳、不掃描、不增加多層審核。升級核准者確認方案差額與 NT$600 審核費全數收款，填寫「ERP 付款憑證號碼／備註」，直接核准。合併收款可使用同一參照並註明，不設憑證號碼的全域唯一限制。

這是人工收款確認政策，不是 ERP 或銀行自動對帳。沒有本機付款訂單也可以由有權限的管理員確認 ERP 收款。先前的付款矩陣屬於舊版自動核對需求；保留原始失敗報告與證據，不將本次通過解釋為已實作自動驗證金額、幣別、退款或憑證真偽。

## 實作

- 管理後台升級詳情新增 ERP 憑證號碼／備註（最多 500 字）及「已確認方案差額及審核費 NT$600 全數收款」。兩者完成才能核准；切換申請會清除輸入，避免沿用前一筆確認。
- 升級申請建立時不再要求先勾審核費；付款在核准當下確認。轉讓、退出與再轉讓保留原流程。
- 核准 API 接收 `paymentConfirmed` 與 `erpPaymentVoucher`。只接受布林 true、去除首尾空白後非空且不超過 500 字的文字；拒絕控制字元、錯誤型別與僅有舊旗標的請求。
- 管理端既有 HTTP guards 限定 SUPER_ADMIN／MEMBERSHIP_OPS；升級 service 另要求 ENTRA 管理員 principal、有權角色及存在的 Person。既有組織歸屬驗證維持不變。
- 伺服器將人工收款紀錄存於工作流程 payload.manualPayment，包含憑證參照、確認人 ID／姓名、伺服器確認時間與 MANUAL_ERP_REFERENCE 方法。提交時的同名資料會被移除，不能偽造確認人與時間。
- 收款紀錄、核准狀態、方案歷史及稽核事件同一交易提交；操作紀錄失敗會全部回滾。已核准工作流程不能再次核准覆寫憑證。詳情顯示確認人、時間與原始參照。
- 使用現有 JSON payload 與 audit_event，不新增資料庫 migration。

## 驗證

| 範圍 | 結果 |
|---|---|
| 升級付款 acceptance：3 組 | 56 PASS／0 FAIL／0 SKIP |
| 相關升級、權限、時間、轉讓、退出及歷史獎金回歸：7 組 | 103 PASS／0 FAIL／0 SKIP |
| 後台欄位互動／切換申請／送出內容 | 1 PASS |
| API 測試 TypeScript、Admin TypeScript | PASS |
| API 與 Admin build | PASS；Admin 仍有既有 bundle 大小警告 |
| 真實 PostgreSQL 初始化斷言 | 162 PASS，重跑不累加 |

新增 17 個 acceptance 案例包括：三種升級方向人工 ERP 確認成功、同一憑證備註可供合併收款、確認人／時間由伺服器產生、重複核准不能覆寫、四種無效確認值、六種無效憑證、三種越權角色、稽核寫入故障後交易回滾。正向案例刻意沒有本機訂單，符合使用者確認的 ERP 外部管理政策。Controller 參數傳遞由實際呼叫驗證；完整 HTTP 角色回歸使用原有 guard 測試。

原有 39 個 acceptance 案例現在驗證的是「舊付款旗標及任意訂單資料不能取代核准時明確的人工 ERP 確認」。其中控制案例錯誤碼與矩陣名稱已依新政策更新，其餘拒絕與不變更歷史的斷言保留。

未執行全庫回歸、真實瀏覽器登入操作、ERP 連線或銀行驗證；其他制度與千人新重試策略驗收不屬本次通過範圍。

## 證據與交付

- `C:/UCell/logs/institution-erp-reference-acceptance-20261011.json`／`.log`
- `C:/UCell/logs/institution-erp-reference-regression-20261011.json`／`.log`
- `C:/UCell/logs/institution-erp-reference-manifest-20261011.json`：來源與證據 SHA-256、測試與清理狀態。
- `backend/apps/api/test/institution-upgrade-erp.acceptance.ts`
- `admin/src/features/workflows/WorkflowsPage.test.tsx`

測試僅使用專用 loopback PostgreSQL 容器與合成資料，未實際收付款／發出外部通知。兩個隔離 runner 已清除測試資料庫；確認剩餘零個後移除本次容器與匿名資料卷。

工作區既有未提交修改保留。嘗試 Git diff 時回報既有 object `bb8a611c2b0c35ccb54b44101c3cdb1289189048` 無法讀取；本輪未修復 Git 儲存庫，未 commit 或部署。來源檔案與測試結果可直接讀取，並以 manifest 雜湊保留交付內容。
