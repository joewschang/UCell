# 年度 GLOBAL 公司證據失敗與重試 — 2026-10-14

## 執行狀態

年度套件 130 / 130 PASS、0 FAIL，192.434 秒；原有 128 項回歸加上 2 項新增案例。API e2e 型別檢查通過。另有 162 項 DB 基線斷言通過，不加入 130 項。以下兩項預期均經本輪執行驗證。

## 新增案例

1. 將缺少歷史樹歸屬的公司所有權 fixture 提交至隔離資料庫，再直接呼叫正式 GlobalPoolService，沒有外層回滾交易或交易代理。連續兩次應以歷史樹證據缺漏拒絕；每次均比對完整結算、GLOBAL 獎金、經濟流向、蓄水池 A／B、職級歷史、可付款及歷史重播快照，確保服務自身交易未留下改動。已提交的公司所有權 fixture 則應保留。
2. 將該公司所有權區間結束時間設於 2025-11-01 結算界線，依既有一般會員 Active 狀態重新結算 2025 年 10 月。預期 16,000,000 GPV、15 筆會員 GLOBAL 獎金，分配 799,999.9995、蓄水池 A 0.0005，沒有公司經濟流向；再重試應回傳同一結算且逐筆狀態不變。先前降階退貨原始帳務亦應保持一致。

第二案屬所有權區間結束後的會員結算，不是補齊樹資料後的公司成功承接，也不是公司移轉行政流程驗收。所有權資料直接建立於測試 fixture；金額使用正式計算、持久化服務與真實 PostgreSQL。

## 歷史組織限制

BinaryTreeService.effective 及 attachTreePlacement 均檢查生效時間接近現在（10 秒內）。現有 2025 年年度 fixture 沒有 BinaryTreeMembership，不能透過今天建立的正式樹服務回填過去生效日期。此輪未放寬產品限制或關閉資料庫保護。

後續成功公司承接案例需要自起始即建立完整樹與安置證據的連續測試 fixture，或另有經規格定義的歷史匯入流程。正式 10／25 日曆、完整前後台操作及整體制度驗收仍待完成。本輪未部署 Stage、未執行銀行付款。

## 證據

Runner 回報 API_JEST_ISOLATED_PASS 與 API_JEST_ISOLATED_CLEANUP_PASS。查詢隔離 DB 剩餘 0，專用容器 24c0306f083a847d1cbc57f6897b2c641bfa358f178d2157b7e81a3127a6ad44 已移除。

- backend/apps/api/test/annual-continuous-gpv-payout-db.e2e-spec.ts
- C:/UCell/logs/company-atomic-20261014.json 與 .log
- C:/UCell/logs/company-atomic-typecheck-20261014.log
- C:/UCell/logs/company-atomic-manifest-20261014.json
