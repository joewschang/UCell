# 同一年度組織 EPV 整合驗證 — 2026-10-13

## 結果

70 / 70 PASS、0 FAIL，106.263 秒。新增 12 個月案例及 1 項年度重送與帳務隔離案例，另含既有 57 項 GPV、跨年結轉、退貨與追回抵扣回歸。API e2e TypeScript 檢查通過。本輪只新增測試，沒有產品程式修改，未部署 Stage。

## 每月規則與金額

沿用相同組織、資格與測試規則版本，呼叫正式 EpvService、成熟化及付款分配服務，使用真實 PostgreSQL。以 Asia/Taipei 月份邊界建立 2024 年 1–12 月案例，核對門檻 2,000、EPV 比率 60%、本人獎金 50%、第一代上線 6%。

| 每月測試事件 | 認列 EPV | 本人獎金 | 上線獎金 |
| --- | ---: | ---: | ---: |
| 資格 A 首筆消費 1,500 | 0 | 0 | 0 |
| 同一人另一資格 B 消費 1,500 | 0 | 0 | — |
| 資格 A 再消費 1,500 | 600 | 300 | 36 |

兩資格同屬一人，仍各自計算門檻；每個月重新累計。每月形成 5 筆獎金（含 3 筆零額），成熟後只有 2 筆正額可付款，付款分配總額 336，追回抵扣為 0。

## 年度核對與重送

- 36 筆來源訂單，36 筆 EPV 流水，EPV 合計 7,200。
- 60 筆 EPV 獎金，24 筆正額可付款，年度可付款合計 4,032。
- 每筆認列後立即重送，以及年度末再次重送全部 36 筆，均回覆 ALREADY_RECOGNIZED，年度總量與金額不增加。
- 每月重跑可付款物化，新增筆數為 0。
- 完整比對加入 EPV 前後的 GPV 流水、非 EPV 獎金、原始 Carry、非 EPV 可付款與追回紀錄，內容一致。

## 執行證據與清理

- `C:/UCell/logs/annual-integrated-epv-20261013.json`：70 項通過，其中 13 項為新 EPV 案例。
- `C:/UCell/logs/annual-integrated-epv-20261013.log`：106.263 秒，API_JEST_ISOLATED_PASS 及 CLEANUP_PASS。
- `C:/UCell/logs/annual-integrated-epv-typecheck-20261013.log`：型別檢查，exit 0。
- `C:/UCell/logs/annual-integrated-epv-manifest-20261013.json`：來源及證據 SHA-256。
- 162 項 DB 基線檢查另列，不加入 70 項計數。隔離測試資料庫剩餘 0，專用 PostgreSQL 容器已移除。

## 覆蓋界線與待辦

本次 EPV 歷史是在既有 GPV 年度及跨年案例執行後補入，驗證同組織帳務相容與規則計算，尚非所有事件依時間交錯的完整年度模擬。來源 PAID 訂單由 fixture 建立，未涵蓋實際下單、收款 API 或瀏覽器操作。EPV 僅完成可付款及批次分配，未登錄銀行付款；既有追回案例中的 PAID 也只是模擬付款結果。

同組織情境目前涵蓋 REFERRAL、EQUALIZATION、BINARY、MATCHING、EPV 五類獎金。RPV、RETAIL_REFERRAL、GLOBAL 仍待整合；Active 變動、公司承接、正式 10／25 結算日曆及完整 API／前後台操作也尚未完整驗收。既有 GPV 案例使用合成 UTC 週曆，不可將本次通過解讀為全部制度或正式日曆已驗收。
