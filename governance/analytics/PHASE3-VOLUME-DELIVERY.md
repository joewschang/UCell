# 第三階段：歷史組織業績量與 Carry

日期：2026-09-18。新指標版本 HISTORICAL_VOLUME_30D_V1；不變更 Core 規則 R1.0B，不重算獎金或寫入財務 ledger。有效互動來源仍缺，健康總分維持不可用。

## 已完成與管理口徑

按原始 GPV_CREATED、RPV_CREATED、EPV_CREATED 的 occurredAt 取快照前 30 天（左含右不含），再加入截至快照已記錄且發生的所有 reversalOfEventId 調整。這是「原始事件期間的修正淨量」，不是調整發生期間流量，也不把更早原始事件的本期退貨算入本群。

GPV、RPV、EPV 各自保留原始量、帶正負號調整、淨量與原始事件數；四位小數以 fixed-point bigint 精確加總，JSON 使用十進位字串，圖表僅為相對量。PV 是分類且可能有舊泛型 ledger，不可擅自等同 GPV 或 GPV+RPV+EPV；genericPV 明確為 UNAVAILABLE。GLOBAL 和其他 ruleVersion 也不混入。

每筆來源先驗證 Core HistoricalReplaySnapshot 的 hash、參數版本、事件 ID／時間／資格／原始量。GPV/EPV 用 eventId 查證，RPV 用 recognitionId（sourceLineId）查證並驗 eventId。取保存的 Sponsor/Binary 歷史樹分別歸屬，起點本身排除，最多第 12 代。Binary 左右區採原事件時根球第一條邊。調整始終歸入原事件的歷史位置，即使現在已移動；不從現況樹推導。

範圍是權威 ledger 的 Qualification 貢獻，包含有有效 ledger 證據的系統球；不套用 NASL 自然人或健康比率的人員球分母。當前雷達和歷史業績表的組織、球數可能不同，不能互相作分母。完整掃描無相關事件時零代表「沒有相應已記錄的來源量」，不能推論沒有其他互動或外部資料已全部抵達。

任何候選來源缺歷史證據、重疊父節點、循環、錯誤量或修正不相符，整份各代業績量回 UNAVAILABLE，不提供容易誤讀的部分總量。這是保守的全公司來源覆蓋檢查，無法歸屬的事件即使可能在其他組織也會阻止本報表。NASL 原有投影仍可完成；資料庫錯誤則中止交易。

## Carry

選根球最新一期 BinaryCarry，必須有已 FINALIZED 且 finalizedAt 不晚於快照的對應 BINARY_K1 批次。最新一期尚未 finalized 時標示不可用，不把草稿或舊期當最新結餘。依該批次、規則與 periodEnd 取截至快照最高 sequence 的 ReplayCarryProjection；有修正但缺根球資料时不可退回舊值。

輸出原始左右 Carry、修正後左右 Carry、periodEnd、修正來源與序號。單位為 GPV 點數；Carry 是結餘，不與 30 天業績流量相加。Sponsor 表不提供 Carry。

## API 與運作

GET /api/v1/admin/analytics/sonar/:tree/:qualificationId/volumes 只讀已保存 JSON projection；使用既有 analytics 角色，無成員身分、事件 ID 或內部歷史圖回傳。保留 status、freshness、asOf、ruleVersion、來源期間與 evidenceHash。缺舊版投影回 VOLUME_PROJECTION_NOT_BUILT，管理員更新該組織快照後可用。

資料在現有 rebuild 的 repeatable-read 交易中擷取，和 NASL／雷達一同保存，sourceHash 包含業績投影。無新 migration、無線上遞迴查詢、無修改 Core ledger。全公司自動刷新不建立根球報表；須手動選根球更新或列入既有 UCELL_ANALYTICS_REFRESH_ROOTS。

來源上限：最近 30 天全公司 2,000 筆原始量、20,000 筆調整、6,000 份歷史 envelope。超限不可用，不能截斷發布。規模擴大需另行分区／增量投影。現階段未實作任意期間重建或各期 Carry 曲線。

## 驗證

- 精確小數、三種單位分離、Sponsor/Binary 分離、歷史左右、12/13 代邊界、重疊父節點、負淨量、Carry 修正缺漏、來源上限測試。
- 隔離 PostgreSQL／HTTP 加總測試 58 項通過；驗證歷史來源與現況位置不同、退貨修正、已結算 Carry、更新不寫 ledger、Finance 讀取／客服禁止及回應無事件或成員 ID。
- 前端指標切換、缺證據不造零、Carry／鮮度提示、手機無整頁溢出；production build 通過。既有 bundle >500 kB 警示保留。
- 全套前端曾有 UAT 載入狀態測試失敗，分析與 UAT 個別重跑 28 項通過，未修改 UAT 檔案。

尚缺：有效互動事件與完整健康總分、任意期間業績快照、較大規模增量處理、來源分類漏斗、匯出治理與真實 UAT 校準。此批為開發整合，沒有啟動自動刷新或部署正式環境。
