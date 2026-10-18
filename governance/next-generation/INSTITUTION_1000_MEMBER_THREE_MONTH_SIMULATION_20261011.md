# 1,000 名會員、三個月組織模擬結果

日期：2026-10-11。結論：**單路計算基準 PASS；四路併發 FAIL。完整制度驗收仍未完成。**

## 情境與方法

- 合成歷史日期為 2024 年 1～3 月（含閏年 2 月）。第一月 400 人、第二月 350 人、第三月 250 人，每人一球，月底累積 400／750／1,000 人。
- 每月新增會員分布於 1～20 日。DB 預建 1,000 筆並保存 DRAFT→EFFECTIVE 的未來生效歷史，刻意驗證未來直推不能倒灌到先前月份；不是實際執行 1,000 次註冊、KYC 或會員審批。
- 1,000 個獨立 Person、1,000 球、Sponsor／Binary 各 999 條邊，最大 Binary 深度 40。包含深鏈、寬分支、不同 Sponsor／Binary 路徑；獨立檢查無循環與第 1／3 位直推在左子樹。樹資料由 fixture 建立，並非呼叫安置 API 完成。
- STARTER／ELITE／LEADER 分別 334／333／333 球。每月輪替 0、1,999、2,000、3,000、4,800 元情境；2,000 組分成 1,999＋1，驗證跨門檻當筆生效。每月 Active 均於當月結束失效，下一月重新計算。
- Active 由正式 recognizeConsumption 處理獨立的合成 GPV 來源。EPV 以 fixture PAID 訂單呼叫正式 EpvService；RPV 以 fixture subscription/schedule 呼叫正式 RpvService。這三者共用組織與歷史 Active，但不是同一筆真實付款流過全部經濟管線，不能把三者的測試額相加當成營收。
- 每 20 名會員中的一人，自加入次月起將後續期別設為 CANCELLED，確認不認列 RPV。這是取消狀態保護測試，不是實際退款、解約或追回工作流。

## 單路基準結果

5 個情境測試均 PASS，0 FAIL／SKIP；其中三個月份內逐會員、逐受領球、逐代別執行斷言。不是只有把總額印出，也不把每個迴圈冒算成獨立 Jest 案例。

| 月份 | 新增 | 累積會員 | 當月 Active | EPV 量 | EPV 獎金計算額 | RPV 認列期數 | RPV 量* | RPV 獎金計算額 | 取消期數 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2024-01 | 400 | 400 | 240 | 182,400 | 127,603.2 | 400 | 480,000 | 171,200 | 0 |
| 2024-02 | 350 | 750 | 450 | 342,000 | 231,098.4 | 730 | 876,000 | 376,300 | 20 |
| 2024-03 | 250 | 1000 | 600 | 456,000 | 305,925.6 | 962 | 1,154,400 | 516,200 | 38 |

*RPV 量由獨立只讀程序彙總資料庫，與已完成期數 × 每期 1,200 交叉核對。EPV／RPV 的月量、獎金及筆數均另行稽核通過。獎金欄是 service 的 payableAmount 計算結果，**不是已匯款金額**。

三個月 EPV 量合計 980,400，EPV 獎金計算額 664,627.2；RPV 完成 2,092 期，RPV 量 2,510,400，RPV 獎金計算額 1,063,700；取消 58 期。

逐筆比對的預期值由索引、加入月份、組織父節點與固定規格比率計算，不讀取引擎輸出來定義預期。EPV 月總量、EPV 獎金合計及 RPV 獎金合計另與真實 DB aggregate 比對。

核對內容包含：

- EPV 同月門檻 2,000、超額 ×60%、本人 50%、Sponsor 固定五代各 6%；未活躍代別金額為零，不移交其他代別。
- RPV Binary 固定 G1～G12、每代理論 100；實際歷史直推數對應 5／8／12 代，未解鎖及未活躍不給付，不壓縮代別。
- 每月取得的 Active 球集合與獨立 oracle 完全相符；不依賴可能殘留為 true 的 current activeFlag。
- 季末抽樣重送 EPV 172 筆、RPV 210 筆，另有執行期間重送；重送均回覆已處理。重送前後業績／獎金筆數一致。
- 保存 24,894 筆 RPV 上線獎勵、10,283 筆 EPV 獎金及 2,092 筆重銷站內訊息。每個完成期別恰有一個 messageKey。未呼叫外部通知配送，delivery 數為 0。
- 4～5 月共 850 個未處理期別仍為 SCHEDULED；本輪未執行它們。這不是未到期拒絕的測試，因合成歷史日期早於目前主機時間。

單路測試器記錄 0 次序列化重試。各月執行耗時 441.9 秒／910.3 秒／1284.8 秒；含資料庫往返與測試斷言，不能當作正式環境吞吐量。

## 四路併發結果：未通過

使用同一種 1,000 人情境，四路不同會員工作並行。組織檢查 1 PASS；三個月份 3 FAIL，季末因未完成三月前置条件再 1 FAIL，共 1 PASS／4 FAIL／0 SKIP。季末失敗不是第四種獨立金額缺陷。

測試器累計 424 次可重試錯誤，分類 {"P2034":423,"P2010/40001":1}。即使最多重試 12 次並退避，仍有工作耗盡重試上限。前兩月失敗堆疊涉及 RPV 認列尾端 appendRecognitionMemberMessage 的資料存取，第三月涉及 EPV 的 sealEpvEvent 讀取獎金；根因尚未完整定位，不能只增加重試次數便宣稱併發穩定。

較早診斷另發現 raw query 的 SQLSTATE 40001 被 Prisma 包成 P2010；測試器原本只辨識 P2034，已補上可重試分類。但四路完整重跑仍失敗，原始失敗不會被單路成功覆蓋。

Worker 原始碼會捕捉認列錯誤，下一轮仍會選取未完成的 SCHEDULED／DUE；HTTP filter 對未包裝的 Prisma 錯誤會回 500。本輪沒有驗證正式 Worker 的完整重試時序或修正正式 API。測試器的重試不是正式服務已具備相同行為的證據。

原始碼檢視另發現 captureHistoricalGraph 每筆事件讀取當時全部有效 Sponsor／Binary 邊，對完整祖先路徑逐球查詢方案、狀態、Active 與直推歷史；獎金受領者還有額外查詢。這解釋了規模／深度增加時可能擴大的查詢成本，但尚未以 query profiler 確認時間占比，也不視為已證實的交易衝突唯一根因。後續應量測查詢數、交易時間與鎖定範圍，評估批次讀取，保留歷史快照完整性。

## 本輪未驗證／仍未完成

這輪規模模擬涵蓋 Active、EPV、RPV、歷史生效、取消狀態、重送與站內訊息；**沒有完成同一組織的推薦／對等 K0、Binary Carry／K1、Matching／K2、Global、零售推薦，以及成熟化、銀行付款與退貨追回整條帳鏈**。原有較小案例不替代 1,000 人全獎金結算測試。

前輪的三種升級缺乏付款證據仍可核准，以及失格通知／申覆／公司承接缺少完整流程，維持未解決；本輪没有執行升級或回收，不能據此宣布修復。下一步應先對 RPV 交易衝突建立最小重現及服務端重試驗證，再補上此組織的其他結算與退款總帳。

## 重跑與證據

測試：backend/apps/api/test/institution-1000-three-month.scale.ts。命令：在隔離本地 PostgreSQL 設定 DATABASE_URL 後，執行 pnpm test:institution:1000。INSTITUTION_SCALE_WORKERS=1 為單路基準；=4 為併發測試。INSTITUTION_SCALE_EVIDENCE_PATH 指定逐月證據檔，PHASE2_DB_EVIDENCE_PATH 指定初始化斷言檔。不得指向 Stage／Production。

證據目錄 C:/UCell/logs：

- institution-1000-baseline-jest-20261011.json／.log、institution-1000-baseline-evidence-20261011.json：本輪單路完整結果。
- institution-1000-release-jest-20261011.json／.log、institution-1000-release-evidence-20261011.json：四路失敗結果；檔名 release 不表示驗收成功。
- institution-1000-probe-jest-20261011.json／.log：僅定位第一月的診斷，其他四情境被 testNamePattern 排除，不能計入正式通過。
- institution-1000-initial-partial-20261011.json、institution-1000-four-worker-partial-20261011.json：兩次人工中止的測試器調整過程，均不算通過。
- institution-1000-baseline-phase2-20261011.json：162 項真實 DB 基礎斷言；各 runner 重複執行不重複計算。
- institution-1000-live-audit-20261011.json：獨立只讀資料庫逐月彙總核對。
- institution-1000-baseline-timeout-adjustment-partial-20261011.json：第一月完成後中止以增加每月等待上限，另從頭完成本輪基準；部分結果不混入完整結果。

只使用 loopback 隔離容器、合成會員及交易，未改系統時間、未寫正式資料、未實際收付款或發送外部通知。fsync=off，沒有驗證斷電持久性。會員與事件 UUID 每次不同，业务情境依固定索引規則重現。

結束時確認隔離測試資料庫為 0，已移除本輪容器及匿名資料卷；清理證據為 institution-1000-cleanup-20261011.json。
