# 同一年度組織 RPV 整合驗證 — 2026-10-13

## 結果

最終 83 / 83 PASS、0 FAIL，123.865 秒。新增 12 個月 RPV 案例及 1 項年度重送與帳務隔離案例，另含既有 70 項 GPV、EPV、跨年結轉、退貨與追回抵扣回歸。API e2e TypeScript 檢查通過。本輪修改測試，沒有產品程式修改，未部署 Stage。

## 預付排程與逐月認列

使用同一組織的左側購買資格，透過 SubscriptionService 建立合成年繳方案：預付 24,000、12 期、每期認列金額 2,000、每期 1,200 RPV。測試方案設定 8 盒，不代表本輪驗證出貨流程。

- 建立時恰有 12 筆 SCHEDULED 排程，尚無 RPV 流水。
- 相同冪等鍵重送建立，回傳相同訂閱，排程仍為 12 筆。
- 2024 年各月到期日符合 Asia/Taipei 月初零時；採合成月初認列設定。
- 每月交替使用 API 的 RpvService 及 Worker 的 processRecognition 直接呼叫認列，並由兩個入口重送。
- 每期只有一筆 RPV 流水、一筆站內通知；排程為 RECOGNIZED，workerBlocked 為 false。

## 發獎路徑與付款分配

組織既有兩層推薦關係，但本案例購買資格只有一位安置樹上線。因此只發給安置上線，推薦樹更上一代不會誤領 RPV。

| 核對項目 | 每月 | 年度 |
| --- | ---: | ---: |
| RPV 認列量 | 1,200 | 14,400 |
| 上線獎金筆數 | 1 | 12 |
| 上線獎金／可付款金額 | 100 | 1,200 |
| 正額可付款筆數 | 1 | 12 |
| 站內通知筆數 | 1 | 12 |

每期受獎者快照為 Active、有效直推數 2、解鎖深度 12，實際受獎代數為第 1 代，理論及應付金額均為 100。每月付款分配毛額 100、追回抵扣 0、淨額 100。重跑可付款物化不新增資料。

年度末再次由 API 服務與 Worker 重送所有 12 期，獎金、流水、可付款與通知總數保持正確。完整比對加入 RPV 前後的非 RPV 流水、BonusAward、原始 Carry、非 RPV 可付款及既有追回紀錄，內容一致。

## 首輪失敗與修正

首輪結果為 70 PASS、13 FAIL。RPV 第一個案例在測試資料準備時重複建立同時有效的 accounting.timezone，captureParameters 以 Overlapping effective parameters 正確阻擋；其餘新案例因排程未建立而連帶失敗。既有 70 項皆通過。

修正為在共用初始化參數 Map 中設定唯一的訂閱月曆，沿用原有會計時區，不在執行中追加重疊參數。另修正測試參數的 TypeScript JSON 型別宣告。最終完整重跑 83 項全部通過；沒有放寬產品參數驗證或獎金斷言。

## 證據及環境清理

- 首輪：`C:/UCell/logs/annual-integrated-rpv-20261013.json` 與 `.log`，保留失敗證據。
- 最終：`C:/UCell/logs/annual-integrated-rpv-final-20261013.json` 與 `.log`，83 PASS、API_JEST_ISOLATED_PASS、CLEANUP_PASS。
- 最終型別檢查：`C:/UCell/logs/annual-integrated-rpv-typecheck-final-20261013.log`，exit 0。
- SHA-256：`C:/UCell/logs/annual-integrated-rpv-manifest-20261013.json`。
- 162 項 DB 基線另列，不加入 83 項計數。隔離測試 DB 剩餘 0，專用 PostgreSQL 容器已移除。

## 覆蓋界線與後續

目前同組織案例涵蓋 REFERRAL、EQUALIZATION、BINARY、MATCHING、EPV、RPV 六類獎金。RPV 與 EPV 歷史是在 GPV 年度及跨年案例後補入，尚非全部事件按時間交錯的完整年度模擬。

本輪直接呼叫正式服務與真實資料庫，未涵蓋 HTTP 授權、UI、真實收款、配送或銀行匯款。RPV 只完成可付款與 READY 批次分配。此組織只有一位安置上線，不能視為已在同一年度組織驗證 12 代全鏈、不同解鎖深度或 Active 變動。

後續仍需整合 RETAIL_REFERRAL、GLOBAL，補齊 Active／公司承接變動、正式 10／25 日曆與完整前後台流程。83 項是本套件總數，與前輪 70 項重疊，不能相加為新增案例數，也不代表完整制度驗收。
