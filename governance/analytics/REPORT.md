# NASL 與十二代管理分析第一版

日期：2026-09-18。開發基準：`d7cf494c57d81a1d9d1cdf2878fbbccdc947489c`，獨立工作副本 `analytics-development`。本次為管理分析實作與規格修訂；不是正式環境發布或 R1.0B 獎金制度改版。

## 已交付內容

- `/analytics` 後台頁：NASL 卡片、組成圓環、主要流向、完整轉換矩陣、每日趨勢及明細、加入月份現況分析。
- 推薦與雙軌十二代雷達、各代資格活躍／重購／新增／NASL 風險、左右人數平衡、健康分項與資料覆蓋、受權逐代資格 ID 明細。
- Nest API、獨立 analysis snapshot 資料表與 Prisma model、不可修改／刪除 trigger、repeatable-read 來源擷取、來源 hash、政策版本、副本、idempotency 與 projector advisory lock、稽核證據。
- Historical volume/carry projection 保持 Sponsor Tree 與 Binary Tree 分離，沿原 evidence path 彙總 GPV/RPV/EPV，使用固定四位小數整數運算；未 finalized 或 correction evidence 不完整時顯示 unavailable，不以零值替代。
- 修訂 Dashboard 的「定義尚未核准」說明；維持舊摘要欄位 unavailable，但正確指向專用分析投影。
- 政策與功能盤點：`MANAGEMENT-POLICY.md`、`IMPLEMENTATION-INVENTORY.md`。
- 保留共享工作區既有 NASL 圓環／流向／趨勢元件，納入完整測試並修正完整應用中的深色標題對比與小樣本圖軸重複刻度。

## 驗證證據

| 檢查 | 結果 |
| --- | --- |
| 新增政策、DB、HTTP 隔離測試 | 49 PASS；52 個 migration 從空資料庫套用成功 |
| 既有 Dashboard 日曆／缺值回歸 | 7 PASS |
| 完整 Admin Vitest | 21 個測試檔、61 個測試 PASS |
| 完整 Backend API isolated regression | 58 個 suites、558 個測試 PASS |
| Backend TypeScript build | PASS（API、database、shared 編譯） |
| Admin 正式模式 TypeScript＋Vite build | PASS；demo/full-access 旗標停用；有既有主 bundle 大於 500 kB 的提示 |
| Prisma validate | PASS |
| Source／Security policy preflight | PASS |
| OpenAPI 產生 | PASS，納入新分析路由 |
| 瀏覽器 | 桌面 1440、手機 390；12 代、樹切換、rebuild 接線、無橫向頁面溢出、財務唯讀、客服禁止查詢、無 page error |

`db-http-test.log` 包含真正的 PostgreSQL 測試結果。最新重跑為 49 PASS；測試資料庫採隨機隔離名稱，結束後清除，未把測試會員或付款資料寫入日常資料庫。瀏覽器 fixture 輸出改為每次執行的隔離暫存路徑，避免 Windows/OneDrive 平行寫入鎖定；只有明確指定 `ANALYTICS_BROWSER_FIXTURE_PATH` 時才保存指定 evidence。

`browser-fixture.json` 為該隔離 DB 的真實 API 回應截取，但資料本身是測試 fixture，**不是公司營運數字**。瀏覽器用這份 fixture 攔截 API 以驗證畫面／接線；它不是正式登入或 live production E2E。`desktop.png`、`mobile.png` 與 `browser-results.json` 保存畫面及檢查範圍。

本機副本的 pnpm binary shims 無法解析，最終前端測試與 build 使用已安裝的 Node 工具入口執行同樣檢查，未因此改依賴或放寬測試。

## 操作與剩餘限制

套用新增 migration 後，SUPER_ADMIN 可在後台選擇根球並更新快照。GET 只讀保存資料；第一份快照之前顯示未建立。FINANCE 可讀統計，但不能重建或取得逐代資格 ID。

`pnpm test:analytics`：建立／移除隔離 DB 並執行本模組測試。`pnpm analytics:refresh`：執行一次刷新，須由部署環境提供 API URL、受權 token 與最多 20 個根球；本次未安裝或啟用定時工作。

仍未完成：完整 cohort-age 留存熱圖、來源與自選期間篩選、PV／RPV／EPV／Carry adapter、有效互動事件、完整健康總分、Outbox 增量 projector、定時刷新／運轉 SLO、分析專用匯出、正式資料保留清除程序、真實 UAT 校準。這些均列在盤點清單，不能以第一版畫面完成代替。

首次管理預設沿用核准 30／90 天與七項權重，並依本次設計授權補齊 never-activated、小樣本、風險門檻、下降百分點與新增 normalization；這些不是外部研究或現有公司資料校準所得。詳見政策文件。

本次未 merge main、未推送、未部署正式環境，亦未聲稱全專案 release gates 或商務 provider UAT 已完成。
