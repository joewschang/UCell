# 制度續測：資格異動權限與升級付款驗收

日期：2026-10-11（Asia/Taipei）。本輪結論：**FAILED_BUSINESS_ACCEPTANCE，尚有 3 個制度付款案例失敗**。本報告補充前輪 [制度與功能續測紀錄](INSTITUTION_FUNCTION_CONFORMANCE_20261011.md)；前輪通過數不能取代本輪新增的嚴格驗收結果。

## 實際發現

### 1. 稽核角色可以提交及核准資格異動：已修正

完整 App 的真實 HTTP／權限測試顯示，`COMPLIANCE_AUDIT` 原本可呼叫兩個 POST 方法。QualificationWorkflowController 只有異動端點，卻把稽核角色列於 class-level Roles。服務中針對已加入 Binary Tree 的權限檢查，不能代替所有資格路徑的 HTTP 寫入保護。

已將這個 controller 的寫入角色限定為 `SUPER_ADMIN`、`MEMBERSHIP_OPS`，不改其他 controller 的稽核讀取端點。依據包含既有 TRAIN_B 的稽核讀取邊界，以及 commerce-fulfillment-audit 報告對 auditor mutation 的既有問題紀錄。

新增 14 個獨立 HTTP 案例：上述兩個角色、COMPLIANCE_AUDIT、FINANCE、ORDER_OPS、CUSTOMER_SERVICE 與匿名，分別測提交／核准。前兩角色通過 guard 並呼叫 command；其他角色 403 且不呼叫 command，匿名 401。使用真實合成 Entra session/grant、完整 App 與正式 guards；業務 command 在這組權限測試中為 mock，不把它當作付款或異動完成證據。

### 2. 無效生效時間：已補強

原 controller 以 truthy 判斷 `effectiveAt`，空字串會被當成未指定日期，變成立即核准。現在保留「未提供」與「提供空字串」的差異，service 在進入交易前拒絕無效 Date，回傳 422／`WORKFLOW_EFFECTIVE_TIME_INVALID`。

新增空字串、一般錯誤字串、非法年月日 3 案，均確認 transaction 未被呼叫。這不代表所有日期格式、未來排程及並行核准流程已驗收。

### 3. 無付款仍可升級：已重現，尚未修正

以真實 DB、正式 QualificationWorkflowService 測試。每個案例建立全新的合成會員及球，確認該球沒有任何訂單；僅送入 `payload.reviewFeePaid=true`，核准仍成功、方案被更新、PlanHistory 由 1 筆變 2 筆。

| 案例 | 規格差額 | 審核費 | 應有結果 | 實際結果 |
|---|---:|---:|---|---|
| STARTER → ELITE | 28,800 | 600 | 缺乏付款證據，拒絕核准且保留原方案 | EFFECTIVE，已升級；FAIL |
| ELITE → LEADER | 28,800 | 600 | 同上 | EFFECTIVE，已升級；FAIL |
| STARTER → LEADER | 57,600 | 600 | 同上 | EFFECTIVE，已升級；FAIL |

來源為 Core Logic v4.2 P28／P29。這三案驗證的是「没有任何付款證據卻已核准」，未宣稱驗證了正確付款的成功流程。

後續修正必須串接可追溯的同球、原方案／目標方案、差額、獨立審核費、付款確認與退款／撤銷狀態，並防止付款證據重用及核准競爭。現有旗標不足以證明這些條件。本輪沒有新增另一個可手填旗標來冒充收款證據，也沒有把測試改成預期允許未付款升級。

## 執行與門檻

- 初次測試：17 案中 12 PASS／5 FAIL；失敗為 2 個稽核寫入案例及 3 個付款案例。
- 修正後受影響回歸：8 組／104 案 PASS，0 FAIL／SKIP。包含新權限與時間案例、升級矩陣、舊 workflow、Binary Tree、退出／再轉讓、完整 App 安全門檻。
- 嚴格付款驗收：3 FAIL，0 PASS／SKIP；命令實際以 exit code 1 結束。這是產品驗收缺陷，不是測試基礎設施無法啟動。
- API 測試型別檢查及後端全套 build：PASS。
- 本輪未重跑所有前端、年度及 API 案例。跨輪彙整的 230 組／1,655 個 API regression 案例有最新通過證據，但另有 3 個 acceptance FAIL；不能稱為「全套制度通過」。

新增 `pnpm test:institution:acceptance`，實際命令已驗證會執行這三案。也已接入 backend 的標準 `pnpm test` 串接流程；付款缺陷修正前，該標準流程不能整體通過。完整 `pnpm test` 本輪未再重跑，不能由此宣稱所有 CI／部署管線都已設定為強制阻擋。

付款案例採 `.acceptance.ts`，一般 Jest regression discovery 不收錄，由上述明確 gate 執行；不是 skip、todo 或以較寬鬆期望掩蓋失敗。

## 失格通知、申覆與承接狀態

再次檢索 `evaluateQualificationInactivity`、`firstApplicableInactivityMonth` 與 `RECLAIM_REVIEW`，現有日期 helper／evaluator 僅有測試呼叫，未找到相連的正式月結、通知、申覆、回收核准與公司承接管線。通用通知或人工 EXIT／COMPANY_RETRANSFER 的存在，不能當成 LIFE-05～08 已完成。

因此維持 **MISSING_INTEGRATED_WORKFLOW／未驗收**。既有公告生效日、異議期限、承接權限與指定公司等啟用條件仍待正式有效政策；本輪沒有啟用十二月回收、倒填日期或改動真實會員權益。

## 證據與隔離

來源檔：

- `backend/apps/api/test/institution-workflow-role-http-db.e2e-spec.ts`
- `backend/apps/api/test/institution-workflow-time.e2e-spec.ts`
- `backend/apps/api/test/institution-upgrade-payment.acceptance.ts`
- `backend/apps/api/src/modules/qualification/qualification-workflow.controller.ts`
- `backend/apps/api/src/modules/qualification/qualification-workflow.service.ts`

原始執行證據位於 `C:/UCell/logs/`：

- `institution-next-red-20261011.json`／`.log`
- `institution-next-regression-20261011.json`／`.log`
- `institution-next-acceptance-20261011.json`／`.log`
- `institution-next-green-phase2-20261011.json`：162 項 DB 初始化斷言；不把多次執行重複加總。
- `institution-next-typecheck-20261011.log`、`institution-next-build-20261011.log`
- `institution-conformance-inventory-next-20261011.json`：總狀態 FAILED_BUSINESS_ACCEPTANCE，保留 3 個失敗及來源 hash；未覆寫前輪盤點檔。

本輪僅使用 `ucell-conformance-next-20261011` loopback 容器的隔離 DB、合成會員及交易；未寫入 Stage／Production，未實際收款、退款、匯款或發送通知。fsync=off，未驗證斷電持久性。

結束時已確認測試 DB 為 0，並移除本輪容器與匿名資料卷；清理證據為 `institution-next-cleanup-20261011.json`。
