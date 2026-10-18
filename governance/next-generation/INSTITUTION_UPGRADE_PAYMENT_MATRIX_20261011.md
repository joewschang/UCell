# 升級付款續測：跨方案負向驗收矩陣

日期：2026-10-11。狀態：**FAILED_BUSINESS_ACCEPTANCE，付款核對缺口尚未修復**。

延續董事會海報揭露的三個失敗案例，本輪將升級付款驗收擴充為兩組、39 案：**3 PASS／36 FAIL／0 SKIP**。其中原有未付款案例 3 FAIL；新增矩陣 36 案包含 33 FAIL 與 3 PASS 控制案例。這是同一根因的多條件重現，不是 36 個獨立產品缺陷，也不能與今日其他回歸通過數直接相加。

## 執行結果

以下每種情境均逐一驗證 STARTER→ELITE（差額 28,800）、ELITE→LEADER（差額 28,800）、STARTER→LEADER（差額 57,600），另需審核費 600。

| 情境 | 案例數 | 驗收結果 |
|---|---:|---|
| 原有：沒有訂單，僅聲稱已付審核費 | 3 | FAIL |
| 任意產生不存在的付款訂單參照 | 3 | FAIL |
| 差額與審核費訂單存在但都未付款 | 3 | FAIL |
| 僅付審核費，沒有差額訂單 | 3 | FAIL |
| 僅付差額，沒有審核費訂單 | 3 | FAIL |
| 差額已付，但審核費僅付 599 | 3 | FAIL |
| 差額與審核費付款屬於另一球 | 3 | FAIL |
| 數值相同但幣別為 USD，而非 TWD | 3 | FAIL |
| 訂單用途為 RETAIL，不能作為升級專用付款 | 3 | FAIL |
| 曾付款，但訂單現為 VOIDED | 3 | FAIL |
| 曾付款，但訂單現為 RETURNED | 3 | FAIL |
| 訂單投影標 PAID，卻沒有付款事件 | 3 | FAIL |
| 控制：沒有審核費旗標，拒絕且無異動 | 3 | PASS |

33 個新增負向案例均走到正式核准方法，實際結果都是工作流程 EFFECTIVE、方案升級、歷史由 1 筆增加為 2 筆，原歷史被關閉。期望則是 HTTP/domain 422 拒絕、工作流程維持 SUBMITTED、方案與歷史不變。測試只接受真正的 422 業務拒絕；連線、SQL 或測試初始化錯誤不會被計為通過。

## 測試真實程度

- 隔離 PostgreSQL 16：全部 migrations 成功；162 項既有資料庫基礎斷言 PASS，不因重跑而重複計數。
- 新增 54 筆合成訂單；42 筆 PAYMENT_CONFIRMED 事件由正式 `OrderService.confirmPayment` 寫入，連同正式 IdempotencyService、AuditService、OutboxService 執行，並驗證事件只有一筆。
- 訂單外殼是測試 fixture；沒有呼叫真實銀行／金流。沒有執行其 SALE_CONFIRMED 下游消費，因此不能宣稱商品業績、退款或完整升級支付流程已驗收。
- VOIDED／RETURNED 是付款後的測試狀態建置，不是正式退款流程或實際退款完成證據。
- payload 裡的訂單參照是故意加入的未受信任輸入，並非既有正式付款綁定協定。測試證明錯誤付款資料未阻止升級，未宣称系統已支援這些欄位。
- 這輪沒有「有效且正確付款升級」正向驗收；不能把能核准當成付款核對已完成。
- API 測試 TypeScript 檢查 PASS。沒有修改正式服務，未重新執行所有 API／前端回歸。

## 根因與修復邊界

`QualificationWorkflowService.approve` 只檢查 payload.reviewFeePaid，再修改方案歷史；UPGRADE 分支沒有讀取訂單或收款事件。既有商務付款確認方法能產生付款事件，但工作流程尚未建立升級專用的不可變付款用途與核銷關聯。資格套組購買路徑會建立新球，不能直接當成既有球的差額升級。

因此本輪未用另一個人工旗標，或任意收取同金額訂單，來將失敗案例改成通過。也未以一律禁止升級冒充正向流程修復。仍需完成以下實作與對應驗收：

1. 由伺服器建立同一球、來源方案、目標方案、規則版本及差額／審核費的不可變付款義務，防止呼叫端指定用途或金額。
2. 正式訂單與付款事件連回該義務；核對 TWD、實收金額、有效收款、退款／作廢，以及差額與審核費各自的用途。
3. 在同一交易核銷付款與變更方案；唯一限制防止證據重用，並處理同時核准、付款撤銷與舊申請的競爭。
4. 三種方向的有效付款正向案例、所有本輪負向案例、重送與並行、付款後退款／追回、稽核紀錄、商品／業績分類均需驗收。

董事會海報是前一輪快照，當時「3 項失敗」仍屬實；本輪擴充後現在應報「升級付款驗收 39 案，36 失敗、3 通過；同一根因尚未修復」。千人新重試策略、失格／申覆／承接與完整八獎金帳鏈，未在這輪補驗。

## 可追溯證據

- 新案例：`backend/apps/api/test/institution-upgrade-payment-matrix.acceptance.ts`。
- 既有門檻 `pnpm test:institution:acceptance` 的 acceptance 檔案匹配規則會收錄此檔；本輪使用相同隔離 runner 與 regex 執行，實際 exit code 1，未修改期望值或跳過失敗。
- `C:/UCell/logs/institution-upgrade-payment-matrix-20261011.json`：Jest 逐案結果。
- `C:/UCell/logs/institution-upgrade-payment-matrix-20261011.log`：migrations、162 項斷言、39 案結果與清理紀錄。
- `C:/UCell/logs/institution-upgrade-payment-matrix-evidence-20261011.json`：33 案的訂單條件與核准後實際狀態。
- `C:/UCell/logs/institution-upgrade-payment-matrix-manifest-20261011.json`：來源／證據雜湊與容器清理結果。

全程為本機 loopback 隔離資料庫與合成資料；未部署或更動真實會員、未實際收付款、未送出外部通知。本次 PostgreSQL 使用預設 fsync，仍未執行斷電持久性測試。隔離 runner 已刪除測試資料庫，專用容器與匿名資料卷於結束時移除。
