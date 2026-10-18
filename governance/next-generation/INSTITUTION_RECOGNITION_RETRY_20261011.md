# 正式認列重試流程：API、Worker 與回滾驗證

日期：2026-10-11。**本輪正式重試、HTTP 錯誤契約及 Worker 再輪詢案例通過；完整制度尚未全部驗收。** 延續 [並行修正報告](INSTITUTION_CONCURRENCY_REPAIR_20261011.md)。本輪未重新執行 1,000 人三個月情境，不能把前輪含測試器重試的通過直接當成新重試上限的規模驗收。

## 正式程式變更

- API 的 RPV／EPV，以及 Worker 的 RPV，加入共用交易重試。每次重新開啟完整 Serializable transaction；最多四次嘗試（首次＋三次重試）。失敗交易先回滾並釋放鎖，才退避。
- 僅處理 P2034，以及 P2010 包裝的 SQLSTATE 40001／40P01。三次等待分別為 50～99、100～149、200～249 毫秒；這不是整個請求的時間上限，交易本身仍需執行時間。
- 不在同一次呼叫內自動重試唯一限制、一般業務錯誤、連線失敗或交易逾時等未知提交結果。重試 callback 只包住資料庫交易，未加入外部通知或金流呼叫。
- API 耗盡次數時回傳 HTTP 409、`RECOGNITION_RETRY_EXHAUSTED`，正式 ApiExceptionFilter 保留 `details: { retryable: true, attempts: 4 }`。呼叫端應重送相同 order／recognition ID；不回傳原始 SQL 錯誤。結構化操作紀錄將此特定 409 標為可重試。
- Worker 耗盡後仍保留 SCHEDULED／DUE，下一次輪詢可再選取；成功後狀態已變更，不再選取。輪詢錯誤紀錄依已知交易衝突標示 retryable。既有輪詢仍可能再次選到永久業務錯誤的未完成項目；本輪沒有新增隔離佇列或永久錯誤人工處置機制。

## 新增 23 個案例

| 範圍 | 案例數 | 實際證據 |
|---|---:|---|
| API RPV、Worker RPV、API EPV × 三種中止碼 | 9 | 正式 service 完成交易內所有寫入後注入錯誤，讓真實 PostgreSQL transaction 回滾。第二次嘗試成功；僅有一筆業績、正確獎金、單一快照，RPV 僅一筆通知。不是只在交易開始前 mock 失敗 |
| 三條路徑耗盡四次嘗試 | 3 | 每次都在寫入後中止。API 回 409，Worker 保留資料庫錯誤；沒有殘留業績、獎金或通知，排程仍未完成；後續正常重送成功 |
| 真實 Worker 輪詢 | 1 | 第一輪四次交易中止，仍為 SCHEDULED 且零業績；第二輪完成；第三輪不再處理。確認一筆業績、一筆 RPV 獎金、一筆通知。是直接呼叫正式 pollRecognitions 的三輪，不是長時間啟動完整 daemon |
| 同一期 API／Worker、同單 EPV／EPV 並行 | 2 | barrier 使兩筆初次讀取同時完成；呼叫端不補重試，正式重試邏輯使兩請求完成，僅一份業績、獎金及快照 |
| API RPV／EPV 的 HTTP 耗盡回應 | 2 | 使用 Fastify、正式 Controller／Service／ApiExceptionFilter，真實本地 HTTP 請求驗證 409、明確代碼、details 與 request ID，未洩漏原始錯誤。此組交易入口為故障 stub，未載入完整 App 的認證 guards；業務與 DB 回滾由上列實庫案例驗證 |
| 不應自動重試的錯誤 | 6 | P2002、P1001、P2028、P2010/23505、P2010/55P03、一般業務 Error 均只呼叫一次，原錯誤保留 |

RPV fixture 含一位有效上線，應付 100；EPV fixture 消費 3,000、門檻 2,000，EPV 600，本人 300、上線 36。斷言金額與筆數，不以「沒有拋錯」替代財務驗算。

九個故障注入案例修正前全部 FAIL，修正後全部 PASS。HTTP 測試搭建時發現環境使用 Fastify，已修正測試 adapter 與正式錯誤 envelope；早期搭建失敗不列為產品缺陷，也不列為通過。

## 最終執行結果

- 11 組／86 案 PASS，0 FAIL／SKIP。包括新增 23 案、前輪鎖與索引案例、RPV 逐代矩陣、年度 EPV／RPV、EPV lineage、Worker loop／outbox、結構化錯誤回歸。
- 已編譯版本的 RPV golden 並行／歷史追回測試：20 項斷言 PASS。原腳本預期一個競爭請求失敗，已改成兩請求透過正式重試完成、其中一個回覆已認列；原始快照與追回去重斷言仍保留。
- Database package、API、Worker build 與 API 測試型別檢查 PASS。
- 各隔離 Jest runner 的 162 項初始化 DB 斷言，不因重複執行而累加。
- 未重跑全部 API／前端；未驗證新重試策略在 1,000 人負載下的端到端結果、跨主機中斷、正式身分登入或真實外部配送。

## 尚待完成

新 API 重試上限下的規模驗收、正式呼叫端的 409 再送策略、永久失敗排程的人工處置仍需補驗。未付款仍能核准升級的三個已知 FAIL、失格通知／申覆／承接、完整八項獎金與退款追回帳鏈，均未在本輪解決。

本輪未部署 Stage／Production，未更動獎金公式或交易隔離等級；使用 loopback 隔離 PostgreSQL、合成會員與交易，無實際收付款或外部通知。fsync=off，未測斷電持久性。

## 重跑與證據

新增測試：`backend/apps/api/test/institution-recognition-retry-db.e2e-spec.ts`、`institution-recognition-retry-http.e2e-spec.ts`，由一般隔離 Jest discovery 收錄。

隔離 local DATABASE_URL 設定後，可用 `node scripts/api-jest-isolated.mjs --runTestsByPath test/institution-recognition-retry-db.e2e-spec.ts test/institution-recognition-retry-http.e2e-spec.ts` 重跑新案例。編譯 packages／API 後，可用 `node scripts/db-golden-isolated.mjs --rpv-concurrency` 重跑指定 golden；未加參數時原完整 golden 清單維持不變。

證據在 `C:/UCell/logs/`：

- `institution-retry-red-20261011.json`／`.log`：九個修正前失敗。
- `institution-retry-green-20261011.json`／`.log`：九個修正後通過。
- `institution-retry-final-20261011.json`／`.log`：11 組／86 案最終結果。
- `institution-retry-golden-20261011.log`：編譯版本 20 項 golden 斷言。
- `institution-retry-build-20261011.log`、`institution-retry-api-build-20261011.log`、`institution-retry-worker-build-20261011.log`、`institution-retry-typecheck-20261011.log`。
- `institution-retry-cleanup-20261011.json`、`institution-retry-manifest-20261011.json`：隔離資源清理及交付檔案雜湊。
