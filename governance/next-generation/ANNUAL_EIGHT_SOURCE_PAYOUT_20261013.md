# 八來源獎金年度付款整合驗證 — 2026-10-13

## 本輪結果

在隔離 PostgreSQL，使用同一合成會員資格及測試規則版本，執行 2024 年 12 個月份的八來源帳務循環；年底資料延伸至 2025 年等待期結束。沒有變更系統時鐘或連接銀行。

每月六種 BonusAward 來源 REFERRAL、RETAIL_REFERRAL、EQUALIZATION、BINARY、MATCHING、EPV 分別給定測試額 10、20、30、40、50、60；原生 RPV_UPLINE_AWARD 給定 70、GLOBAL_POOL_AWARD 給定 80。這些數字是驗證路由的合成獎金額，**不是制度公式計算的預期獎金**。

- 每月 8 筆來源 → 8 筆可付款 → 1 筆付款明細，總額 360，追回抵扣 0。
- 逐一核對八種類型、來源表及金额；付款明細完整包含該月八筆來源。
- 六種共用等待期獎金經正式成熟化服務處理，再經正式 UnifiedPayableService 建立可付款及批次。
- 經正式 AdminOperationsService 執行不同 actor 的財務覆核、合規核准、匯出紀錄。
- 每月依序登錄 FAILED 0、部分 PAID 180、全額 PAID 360；批次狀態依序 FAILED、PARTIALLY_PAID、PAID。
- 每個結果以相同內容再次送出，均回覆 replayed，仍只有 3 筆付款結果。
- 年底 96 筆唯一來源、12 個 PAID 批次、總額 4,320、36 筆付款結果；再次 materialize 沒有新增，期末再次分配總額 0。

付款結果為累計金額，不將部分 180 加上全額 360 誤當作已付款 540。

## 測試證據

| 範圍 | 結果 | 證據 |
| --- | --- | --- |
| 新增 12 個月案例＋年度總帳核對 | 13 / 13 PASS | `C:/UCell/logs/annual-eight-source-final-20261013.json` |
| 既有付款結果／追回回歸 | 21 / 21 PASS | `C:/UCell/logs/annual-eight-source-20261013.json` 中 payout-result-recovery suite |
| 既有 Member GLOBAL 退貨、追回抵扣、付款整合 | 1 / 1 PASS | 同檔 member-global-economic suite |
| API e2e 全域 TypeScript 檢查 | PASS | `C:/UCell/logs/annual-eight-source-typecheck-final-20261013.log` |

以上共 35 個不同案例通過；初次總測試報告本身仍為 FAIL，不能將其標成全套成功。新增案例首次缺少 RPV 認列排程，被真實資料庫外鍵拒絕；補齊原生訂閱及排程 fixture 後，重跑新 suite 通過。各月份的首次失敗與期末衍生失敗，不是 13 個不同產品缺陷。

全域型別檢查另發現前輪日期 Map 的 key 被推導成 UUID template literal，已明確指定 `Map<string,Date>`；屬測試型別修正，執行邏輯不變。初次錯誤記錄保留。

隔離 runner 的 162 項 DB 基線另列，不併入 35 項。測試 DB 與容器於完成後清理。

## 覆蓋限制與下一步

本輪新增測試及一處測試型別修正，沒有變更產品業務邏輯，也沒有部署 Stage。

來源獎金、RPV 認列完成狀態與 GLOBAL 結算資料直接建立為 fixture；雖然來源表、外鍵、成熟化、可付款、核准和結果登錄都走真實資料庫／服務，仍不等同八種獎金從真實下單起算的完整年度端到端驗收。沒有真實登入、瀏覽器、銀行付款或程序重啟驗證。

追回情境由另外兩組既有回歸驗證，尚未與同一個年度八來源組織整合。下一步需要將原始訂單、樹形及歷史資格輸入接到正式獎金計算器，並串入跨年退貨／追回、不活躍與公司承接，再以制度公式独立驗算。
