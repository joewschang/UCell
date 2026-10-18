# 同一年度組織零售推薦整合驗證 — 2026-10-13

## 結果

最終 96 / 96 PASS、0 FAIL，140.054 秒。新增 12 個月零售案例及 1 項年度重送／帳務隔離案例，另含既有 83 項回歸。API e2e TypeScript 檢查通過。本輪只修改測試，沒有產品程式變更，未部署 Stage。

## 每月四種條件

沿用既有年度組織與測試規則版本，新增一位無會員資格的合成零售購買人。每月建立四筆 PAID 訂單及不可變明細快照，每筆淨額 1,000，啟用案例使用測試 SKU 比率 10%。這是測試商品設定，不代表所有正式商品均使用此比率。

| 明細條件 | 理論獎金 | 可付獎金 | 是否形成獎金紀錄 |
| --- | ---: | ---: | --- |
| 有效且 Active 推薦人 | 100 | 100 | 是 |
| 非 Active 推薦人 | 100 | 0 | 是 |
| 未啟用零售推薦獎金 | — | — | 否 |
| 未指定推薦人 | — | — | 否 |

每月處理前，刻意將測試商品規則比率由 10% 改成 5%，正式 Worker 仍依訂單明細快照的 10% 計算。這是用來驗證歷史快照的直接 fixture 變更，不是測試正式商品版本發布流程。

兩筆獎金均有 CALCULATED、PENDING_45D 紀錄，pendingUntil 為來源付款時間後 45 天。成熟化後只有正額獎金形成可付款；每月批次毛額 100、抵扣 0、淨額 100，收受者為指定的有效推薦資格。

## 事件重送與年度核對

使用正式 claimOutboxLease、withOutboxLease 及 processRetailReferralPayment，未替換租約交易。每筆來源先正常处理，再以新 Outbox 事件送入相同訂單；年度末再新增事件重送全部訂單。每次事件完成後再使用舊租約，回傳 lostLease，不能再次處理。

- 全年 48 筆來源訂單。
- 24 筆獎金紀錄，其中 12 筆零額。
- 12 筆正額可付款，合計 1,200。
- 年末重送後，零售獎金完整資料與重送前一致。
- 每月重跑可付款物化，新增筆數為 0。
- 零售來源没有新增 PV，零售購買人仍沒有會員資格。
- 原有 PV 流水、非零售 BonusAward、RPV 獎金、非零售可付款、Carry、追回紀錄及既有資格的推薦／安置關係，完整比對不變。

## 首輪失敗與修正

首輪 83 PASS、13 FAIL。未啟用獎金的 fixture 仍填入 calculationType、rate、baseType，被 retail_referral_snapshot_shape 資料庫限制拒絕，12 個月案例皆停於資料建立，年度案例亦未完成。

依資料庫規格將停用案例上述三欄設為 null，保留啟用案例的快照及全部斷言。重新型別檢查與完整資料庫回歸後 96 項通過。修正屬測試資料，不是產品缺陷修補。

## 證據與清理

- 首輪：`C:/UCell/logs/annual-integrated-retail-20261013.json` 及 `.log`。
- 最終：`C:/UCell/logs/annual-integrated-retail-final-20261013.json` 及 `.log`，96 PASS，API_JEST_ISOLATED_PASS、CLEANUP_PASS。
- 型別檢查：`C:/UCell/logs/annual-integrated-retail-typecheck-final-20261013.log`，exit 0。
- 證據 SHA-256：`C:/UCell/logs/annual-integrated-retail-manifest-20261013.json`。
- 162 項 DB 基線另列，不加入 96 項計數。隔離 DB 剩餘 0，專用 PostgreSQL 容器已移除。

## 覆蓋界線及後續

同組織案例目前涵蓋 REFERRAL、EQUALIZATION、BINARY、MATCHING、EPV、RPV、RETAIL_REFERRAL 七類獎金，GLOBAL 尚待整合。

本輪將零售歷史補入先前年度案例之後，並非全部事件依時間交錯的完整年度模擬。PAID 訂單、推薦歸屬及明細快照由 fixture 建立，後續獎金計算、租約、成熟化及付款分配使用正式服務與真實 PostgreSQL。尚未驗證完整 HTTP／前台購物／後台收款操作、歸屬設定流程、銀行匯款；零售批次只完成 READY 分配。

這輪沒有新增零售退貨追回、非 Active 後恢復、公司承接、正式日曆或多 Worker 併發搶單案例。這些及全球分紅、全流程驗證仍須繼續。96 項含前輪回歸，不能與 83 項相加，也不代表全部制度驗收完成。
