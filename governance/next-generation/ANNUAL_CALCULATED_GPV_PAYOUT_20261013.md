# 正式 GPV 計算至可付款驗證 — 2026-10-13

## 完成內容

新增同一組織跨 2024 年 12 個月份的抽樣週測試：每月第一個星期日起七天，左右買方各一筆 1,000 GPV。使用合成已付款訂單及歷史資格／組織作為輸入，正式 recognizeConsumption 產生 GPV、sealGpvEvent 保存歷史快照，正式 K0／K1／K2 服務計算獎金，再經成熟化與可付款服務建立付款明細。沒有直接建立 BonusAward 或 PayableEntry 作為此案例的來源。

這是 **12 個月各抽一週**，不是全年所有週的完整制度驗收。測試使用明示的合成 UTC 週曆，沒有改正式營運日曆；訂單及付款狀態仍由 fixture 建立，未走下單／收款 API。業務日期使用歷史時間，獎金生命週期寫入及成熟化使用實際處理時間，不變更主機時鐘。

## 獨立期望與結果

測試先鎖定 Starter 推薦 15%、G2 對等 10%、對碰 12%、Matching G1 15% 參數；各池在本情境皆 K=1。

| 類型 | 每個抽樣週手算 | 每週結果 |
| --- | --- | --- |
| REFERRAL | 2 × 1,000 × 15% | 300，2 筆 |
| EQUALIZATION | 2 × 150 × 10% | 30，2 筆 |
| BINARY | min(1,000,1,000) × 12% | 120，另有一筆零額紀錄 |
| MATCHING | 120 × 15% | 18，1 筆 |
| 可付款 | 300 + 30 + 120 + 18 | 468，分成 420 與 48 兩資格明細 |

12 個抽樣週合計：24 筆 GPV、36 個 FINALIZED 結算批次、84 筆計算獎金（含 12 筆零額）、72 筆可付款，金額 5,616。每期左右 CarryOut 均為零。重送 GPV 認列、重跑三種結算及 materialize 都沒有重複經濟效果；零額獎金有稽核紀錄但不形成可付款。

## 實際缺陷與修正

整合測試發現初始 CALCULATED 與 PENDING_45D 可能同毫秒寫入。原成熟化僅按 occurredAt 降冪取一筆，資料庫在同時間戳下可能取到 CALCULATED，導致漏成熟。可重現記錄 `annual-calculated-gpv-final-20261013.json` 為 9 PASS／4 FAIL；後續月份有衍生積壓，不代表四個獨立產品缺陷。

修正 `matureBonusAward`：保留獎金列鎖，先檢查是否已有初始兩狀態之外的後續歷程，有則不再成熟；再明確查找 PENDING_45D。避免依賴同毫秒順序，也避免重播時追加第二筆 EFFECTIVE。新增真實 DB 同時戳與兩處理者併發測試，兩次呼叫一成功一略過，再重送仍只有一筆 EFFECTIVE。

早期案例另修正測試本身兩處：BinaryCarry 查詢應使用資格／期末／規則版本鍵；零額 BINARY 是合法計算紀錄，不能把它當成不應存在的獎金。均保留先前失敗證據，沒有修改公式配合期望。

## 最終驗證

- 55 / 55 PASS，0 FAIL：`C:/UCell/logs/annual-calculated-gpv-repaired-20261013.json`。
- 13 項正式 GPV 計算鏈路、2 項成熟化積壓／同時戳、13 項八來源付款、27 項獎金引擎案例。這是 DB 整合與單元測試混合，不能全部稱為 DB 案例。
- Database build、Worker build、API e2e TypeScript 通過。型別與 Worker 記錄分別見 `annual-calculated-gpv-typecheck-repaired-20261013.log`、`annual-calculated-gpv-worker-build-20261013.log`。
- 隔離 runner 的 162 個 DB 基線斷言另列，不併入 55 案。

## 剩餘範圍

尚未部署 Stage。尚未把 RPV、EPV、RETAIL_REFERRAL、GLOBAL 的原始事件計算與此組織合成同一完整年度；原有八來源付款測試仍是另組 fixture。也未涵蓋全年所有週、池縮放、跨年退貨／追回、不活躍及公司承接、真實銀行或完整瀏覽器流程。
