# 並行認列續測與修正

日期：2026-10-11。**1,000 人三個月、四路並行情境已在測試器重試下完成；完整制度仍未全部驗收。** 本文件補充 [上一輪規模測試](INSTITUTION_1000_MEMBER_THREE_MONTH_SIMULATION_20261011.md)，不覆寫其失敗證據。

## 已重現與修正

1. **通知資格列鎖與外鍵鎖形成死鎖。** 兩筆交易先持有資格列 KEY SHARE，再呼叫正式 appendRecognitionMemberMessage，原本 FOR UPDATE 互相等待，PostgreSQL 明確回報 40P01。改為 FOR NO KEY UPDATE，保留持有人讀取保護，並允許獎金外鍵引用共存。修正後兩筆既有訊息交易皆提交，訊息內容不變；另一個交易實際 UPDATE 持有人仍被 lock_timeout 阻擋（55P03）。沒有降低 Serializable 隔離等級。
2. **來源事件獎金查詢缺少索引。** 在 5,002 筆合成獎金中，以 barrier 控制兩筆不同來源的讀取與新增，原本至少一筆發生序列化衝突。新增 bonus_award(source_event_id, award_type) 索引與 Prisma migration 後，相同案例兩筆均提交。1,000 人實際資料的 EXPLAIN 顯示使用 bonus_award_source_event_type_idx。這是已驗證的衝突改善，不代表每種序列化衝突皆已消失。

另外驗證新增通知在可重試序列化失敗後，整筆交易重送可完成且不重複。測試接受 Prisma P2034 或明確 40001；P2034 本身不能區分死鎖與序列化失敗，因此不把此案當成「所有死鎖消失」的證據。既有訊息的受控死鎖案例另要求兩筆第一次皆成功。

## 執行結果與未覆蓋的差異

- 原始鎖定案例：1 FAIL／1 PASS，明確 40P01；修正後再加入新訊息與實際持有人 UPDATE 檢查。
- 新訊息第一版測試要求所有 Serializable 插入首次成功，實際 P2034 使它失敗；修正測試契約為允許已知可重試中止並驗證完整重送，沒有宣稱服務內自動重試。
- 僅修通知鎖後的 1,000 人重跑：1 PASS／4 FAIL，365 次重試（361 P2034、4 P2010/40001）；此結果仍保留。小型死鎖修正不足以完成整體並行驗收。
- 索引修正前的來源事件獨立案例：1 FAIL；修正後 PASS。
- 最終相關回歸：8 組／55 案 PASS，0 FAIL／SKIP。包含兩組新案例、會員訊息、成長認列、RPV 逐代矩陣、年度 EPV／RPV 與 EPV lineage。
- 最終 1,000 人三個月：5 個情境 PASS，0 FAIL／SKIP；每月逐會員、逐受領球、逐代驗算，獨立只讀資料庫彙總也全部 PASS。
- Database package build、API 測試型別檢查、Prisma schema validate 通過。沒有重跑全部前端／API 回歸。

| 模擬月份 | 累積會員 | Active | EPV 獎金計算額 | RPV 獎金計算額 | RPV 期數 | 取消期數 | 四路耗時（秒） | 前輪單路耗時（秒） |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2024-01 | 400 | 240 | 127,603.2 | 171,200 | 400 | 0 | 169.3 | 441.9 |
| 2024-02 | 750 | 450 | 231,098.4 | 376,300 | 730 | 20 | 323.7 | 910.3 |
| 2024-03 | 1000 | 600 | 305,925.6 | 516,200 | 962 | 38 | 465.6 | 1284.8 |

所有月量、獎金、期數、取消數及季末筆數均與前輪單路結果完全一致。共 35,177 筆 EPV／RPV 獎金、2,092 筆站內訊息；季末重送 EPV 172 筆、RPV 210 筆後筆數未增加，後續 850 期仍未處理。未實際付款或外送通知。

**本輪仍有 482 次測試器重試**，分類 {"P2034":472,"P2010/40001":10}。測試器每次最多重試 12 次並退避，三個月皆完成；未加入正式 HTTP 服務自動重試，也未驗證正式 Worker 完整重試時序。不能因此承諾每個正式 API 首次請求皆成功。耗時包含資料庫往返、快照與斷言，不是正式環境吞吐量或 SLA。

## 驗證範圍與後續

保留原本 400／350／250 人加入、40 層組織、三方案、消費門檻、Active 月份、5／8／12 代、取消及重送案例。會員、訂單與訂閱為合成 fixture，並非 1,000 次實際註冊付款；Active 的合成 GPV 與 EPV／RPV fixture 不是單一實際收款帳鏈。

下一個必要項目是正式 API／Worker 的可重試錯誤契約與負載驗證。先前無付款仍可核准升級的 3 個 FAIL、失格通知／申覆／承接流程、同組織完整八獎金及退款追回，仍未在本輪解決。

新增 migration 尚未部署 Stage／Production；正式套用索引需考慮既有表大小與建索引期間的寫入鎖。本輪只在本地隔離資料庫驗證。測試容器與匿名資料卷已清理，剩餘測試 DB 為 0；fsync=off，不宣稱斷電持久性。

## 重跑與證據

在 backend 設定隔離本地 DATABASE_URL 後，執行 pnpm test:institution:1000，INSTITUTION_SCALE_WORKERS=4。小型案例為 institution-recognition-lock-db.e2e-spec.ts 與 institution-award-source-concurrency-db.e2e-spec.ts，已由一般隔離 Jest discovery 收錄。

原始證據位於 C:/UCell/logs：institution-lock-red-20261011.json、institution-lock-regression-20261011.json、institution-lock-scale-jest-20261011.json、institution-source-red-20261011.json、institution-source-green-20261011.json、institution-concurrency-final-regression-20261011.json、institution-index-scale-jest-20261011.json、institution-index-scale-evidence-20261011.json、institution-index-scale-audit-20261011.json、institution-index-scale-query-plan-20261011.log、institution-index-scale-predicate-locks-20261011.log、institution-concurrency-cleanup-20261011.json。失敗與通過使用不同檔名，未覆寫原始失敗。
