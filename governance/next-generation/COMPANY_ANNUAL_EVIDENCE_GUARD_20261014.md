# 年度公司承接證據缺漏防護 — 2026-10-14

## 結果

年度連續套件 128 / 128 PASS、0 FAIL，185.861 秒；包含原有 127 項回歸及 1 項新增案例。API e2e TypeScript 檢查通過。另有 162 項真實資料庫基線斷言通過，不加入 128 項計數。

## 新增驗證

在既有年度組織的可回滾交易內，建立 2025-10-01 起的公司所有權區間，並結束一般 Active 區間。確認 2025-11-01 沒有一般 Active 紀錄，但公司持有規則仍判定資格有效。

既有年度 fixture 缺少歷史 BinaryTreeMembership。呼叫正式 GlobalPoolService 後，系統以「Company final requires historical tree membership」拒絕公司 GLOBAL 流向。案例再主動拋出回滾訊號，核對結算、獎金、經濟流向、蓄水池 A／B 及可付款筆數未變，臨時公司持有區間消失，先前降階退貨的原始帳務狀態保持一致。

這項測試使用外層交易代理並明確回滾，證明缺漏證據被拒絕及測試資料清理，不能單獨證明服務自身交易的原子回滾。帳務筆數檢查亦不等同逐欄全帳本比對。

## 環境與清理

首次 runner 在執行案例前因 Prisma query engine 缺漏中止。執行 pnpm --filter @ucell/database prisma:generate 成功後重跑，128 項全部通過；首次失敗記錄保留作為環境證據。

Runner 回報 API_JEST_ISOLATED_PASS 與 API_JEST_ISOLATED_CLEANUP_PASS。查詢確認 ucell_jest_% 隔離資料庫剩餘 0，專用 PostgreSQL 容器 482c9a6c01ef8de3098c55c1b539b925217234535d26933e1352a1373e17a6b0 已移除。

## 尚未完成

本輪未改產品邏輯，未部署 Stage。公司承接在同一年度組織的成功結算仍須補齊合法的歷史樹歸屬及安置證據，不能略過資料庫保護。前輪獨立公司專項 14 項不與本輪重複加總。正式 10／25 結算日曆、完整前後台操作及整體制度驗收仍待完成；本輪沒有銀行實際付款。

## 證據

- 案例：backend/apps/api/test/annual-continuous-gpv-payout-db.e2e-spec.ts
- 首次環境失敗：C:/UCell/logs/company-annual-guard-20261014.log
- 最終結果：C:/UCell/logs/company-annual-guard-final-20261014.json 及 .log
- 型別檢查：C:/UCell/logs/company-annual-guard-typecheck-20261014.log
- SHA-256 清單：C:/UCell/logs/company-annual-guard-manifest-20261014.json
