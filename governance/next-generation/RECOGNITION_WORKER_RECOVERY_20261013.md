# Worker 認列隔離與恢復驗證 — 2026-10-13

## 結果

已修正 Worker 每次只取最早 20 筆，持續失敗資料可能阻塞後續認列的問題。新增資料庫持久化恢復欄位；保留原始排程及財務唯一性保障，不更動獎金規則或認列日期。

- 僅資料庫確認已中止的交易衝突允許自動再試。原本每次處理最多四次交易嘗試維持不變。
- 每次完整處理失敗後，Worker 累計失敗次數並依序退避 1、2、4、8 分鐘；第五次失敗隔離，等待人工查核。
- 業務錯誤及不明結果不自動重送，直接隔離。錯誤原因須先修復，再由既有 Super Admin／財務手動入口執行原排程。
- 保存累計失敗次數、最後失敗時間、分類碼及追蹤 UUID。不將原始 SQL 或錯誤文字放入後台欄位。
- 失敗寫入使用 pending status 與已讀失敗次數的條件更新，避免覆蓋較新的失敗、取消或成功狀態。認列成功會清除隔離與待重試時間，保留歷史失敗摘要。
- 後台訂閱詳情可查閱隔離與追蹤資訊；修正 API 略過認列仍被誤標為完成的提示。

## 測試

| 範圍 | 結果 | 證據 |
| --- | --- | --- |
| 隔離 PostgreSQL：交易重試、年度 RPV、部分退貨 | 31 / 31 PASS | `C:/UCell/logs/recognition-worker-recovery-db-20261013.json` |
| Admin 全套 | 269 / 269 PASS | `C:/UCell/logs/recognition-worker-recovery-admin-final-20261013.json` |
| 遷移與資料庫基線 | 162 assertions PASS，另列不併入 31 項 | `C:/UCell/logs/recognition-worker-recovery-db-20261013.log` |
| Database／Worker build、API e2e TypeScript、Admin typecheck／build | PASS | 本輪命令結果；Admin build 記錄見 logs |

關鍵案例：

1. 前 20 筆錯誤排程被持久化隔離，以新 Prisma client 重新連線後，第 21 筆完成真實認列。
2. 隔離排程透過 RPV API service 重複手動執行，再經 Worker polling，只有一筆 PV、一筆上線獎勵、一筆會員通知。
3. 確認交易衝突按退避時間執行；到期前不重跑，第五次後即使推進一天也不再自動嘗試。
4. 另一處理已成功時，遲到的失敗不覆蓋成功，不增加失敗次數。
5. 既有 API／Worker 競爭、交易回滾、12+3 個月 RPV 及部分退貨回歸通過。
6. 稽核角色可見隔離證據但沒有寫入按鈕；API 回覆 skipped 時不顯示認列已完成。

Admin 初次 268 PASS／1 FAIL：成功回覆新增判讀後，重複點擊測試 stub 仍回傳 undefined，已改為實際 API envelope，重跑全套 269 PASS。初次失敗證據保留。

## 部署與限制

- 尚未部署 Stage。新程式使用新增欄位，部署時必須先套用 `20261013000000_recognition_worker_recovery` 遷移並重新產生 Prisma client，再更新 API、Worker、Admin。
- 本輪使用隔離本機 PostgreSQL；沒有重跑千人三個月負載，沒有真實 Worker 程序重啟／斷電測試。新 client 重新連線驗證資料持久化，不等同完整災難復原。
- 恢復欄位保存最後一次失敗摘要，不是每次失敗的不可變稽核歷程；人工修復原因仍未另存正式 Audit。
- 若資料庫無法保存失敗紀錄，會輸出 `RECOGNITION_FAILURE_RECORD_FAILED` 並繼續本輪；持久化故障期間無法保證跨輪隔離，需營運監控處理。
- 多 Worker 尚未加排程租約；財務去重仍由既有 Serializable 交易、訂閱鎖與唯一性約束保護。本輪未做多節點負載測試。
- 完整八獎金年度整合與制度全覆蓋仍未完成，不因本輪通過宣稱全系統驗收完成。
