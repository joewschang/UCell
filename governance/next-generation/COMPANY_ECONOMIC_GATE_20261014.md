# 公司經濟權益與蓄水池 B 回歸 — 2026-10-14

## 結果

4 組測試、14 / 14 PASS、0 FAIL，24.811 秒；API e2e TypeScript 檢查通過。此為既有公司專項案例的獨立回歸，沒有重新執行年度 127 項套件，也沒有把 14 項說成新增制度案例。

本輪新增 `backend/apps/api/test/company-volume-economic.e2e-spec.ts`，將既有受隔離資料庫檢查保護的 `company-volume-economic.integration.ts` 納入標準 API e2e 入口。其餘產品程式未改動，未部署 Stage。

## 驗證範圍

| 套件 | 案例數 | 重點 |
| --- | ---: | --- |
| company-economic.e2e-spec.ts | 1 | 正式推薦／對等／對碰／Matching／Carry、公司 GLOBAL、退貨重播、付款隔離與承接後經濟權益 |
| company-volume-economic.e2e-spec.ts | 1 | 正式 EPV／RPV 公司獎金導向 B、EPV 退貨追加帶正負號效果、重送去重 |
| company-reservoir-invariant-db.e2e-spec.ts | 11 | 缺少公司流向或入帳的偵測、重播效果一致性、來源證據、歷史所有權界線 |
| matured-payable-company-rpv.e2e-spec.ts | 1 | 已導向公司的 RPV 不進會員成熟可付款佇列，同時保留普通會員來源 |

公司專項使用真實 PostgreSQL。核心案例驗證公司來源有經濟流向與 Reservoir B 入帳，退貨使用追加效果而不改原始獎金；公司份額不建立一般會員追回款，也不形成會員可付款。另涵蓋 GLOBAL 公司流向及結算後退貨重播。

歷史所有權案例核對發獎時間的 COMPANY 區間，而不是只看目前持有人；區間結束當下不再列為公司持有。完整性案例在可回滾交易中注入缺漏並檢查告警，未關閉資料庫保護。舊資料會員可付款衝突使用讀取端模擬，因此該項不能宣稱實際成功寫入了受禁止的資料。

## 環境狀況

開始時 Docker 引擎回傳 500，狀態為 stopped；重啟 Docker Desktop 後恢復。第一次 runner 啟動時 PostgreSQL 尚未就緒，連線失敗，未形成測試判定。確認 pg_isready 接受連線後重新執行，4 組 14 項全部通過。

隔離 DB 剩餘 0，专用 PostgreSQL 容器已移除。162 項 DB 基線另列，不加入 14 項。

## 覆蓋界線與後續

這組公司 fixture 與前面的同組織年度案例分開，不表示公司承接已併入那條年度連續模擬。部分完整性與來源測試直接建立獎金或故障資料；核心公司整合案例另使用正式計算服務。未執行完整 HTTP／前後台操作或銀行付款。

後續仍須將公司承接放入連續組織情境，並串接正式結算日曆與完整操作流程。完整制度與 Stage 驗收尚未完成。

## 證據

- 環境初次失敗：`C:/UCell/logs/company-economic-gate-20261014.log`。
- 最終：`C:/UCell/logs/company-economic-gate-final-20261014.json`、`.log`，14 PASS、API_JEST_ISOLATED_PASS、CLEANUP_PASS。
- 型別檢查：`C:/UCell/logs/company-economic-gate-typecheck-20261014.log`，exit 0。
- SHA-256：`C:/UCell/logs/company-economic-gate-manifest-20261014.json`。
