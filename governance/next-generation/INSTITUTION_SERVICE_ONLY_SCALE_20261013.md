# 正式重試策略：千人三個月規模驗收

2026-10-13（Asia/Taipei）。結論：**未通過無呼叫端重送的規模驗收**。5 情境中 1 PASS／4 FAIL／0 SKIP。不是四個獨立財務錯誤。

## 執行方式

新增 `INSTITUTION_SCALE_RETRY_MODE=SERVICE_ONLY`，EPV／RPV 直接呼叫正式 service，只使用既有最多四次交易嘗試；測試器不替認列請求補重試。保留原 HARNESS 模式供比較，沒有調高正式重試上限或放寬金額斷言。

四個並行工作，1,000 位合成會員以 400／350／250 分批加入，模擬 2024 年 1–3 月。三方案、五種消費額、5／8／12 代、取消認列、逐會員獨立預期值沿用前輪。這是正式 service＋資料庫測試，不是實際 HTTP／登入／金流／Worker daemon 負載，也不是八項獎金的完整帳鏈。

Active 的 fixture 建置仍使用原測試器交易重試，實際 95 次 P2034；與 EPV／RPV 呼叫端重試明確分開。本輪未量測正式 helper 內部每次重試的總數，不能把 95 當成正式認列重試次數。

PostgreSQL 16 專用 loopback 容器，使用預設 fsync。沒有執行斷電測試，且設定與前輪不同，耗時不可直接當作效能退步或提升。Database package build 及 API 測試 TypeScript 檢查通過；migrations 與 162 項基礎斷言通過。

## 結果

| 情境 | 結果 | 說明 |
|---|---|---|
| 千人組織與安置約束 | PASS | 1,000 位唯一會員、999 條兩種組織邊、無循環等斷言通過 |
| 1 月 | FAIL | RPV 回覆 RECOGNITION_RETRY_EXHAUSTED；約 47.1 秒即結束該月 |
| 2 月 | FAIL | 同上；約 45.8 秒 |
| 3 月 | FAIL | 同上；約 250.3 秒 |
| 季度重送與完整性 | FAIL（相依失敗） | 完整月份結果為 0，無法進行季度驗算 |

三筆 service failure 都為正式錯誤契約 409、retryable=true、attempts=4。測試直接呼叫 service，409 是 exception 的狀態，不是本輪發出 HTTP 請求取得的回應。每月在第一個工作失敗後停止領取新工作，讓已在執行的工作結束；下一個月份仍按 Jest 案例繼續。因此進度數字不是全月完成率，不能報三個月金額核對一致。

獨立月度唯讀 audit 在來源情境失敗時明確終止並記錄 FAIL，沒有任何月份獲完整 audit PASS。新增這個終止條件以避免來源已失敗卻等待一小時。

## 實際失敗交易的唯讀核對

在測試資料庫清理前，以 RepeatableRead 對前兩筆失敗認列另做唯讀核對：均為 SCHEDULED，對應 RPV 業績 0、上線獎金 0、會員通知 0。確認這兩筆沒有部分提交，符合後續以相同 ID 重送的前提。

第三筆失敗發生於情境結束前；未對它取得同樣的獨立資料庫快照，不能將前兩筆結果擴大宣稱為三筆全數實庫核對。原有故障注入回滾案例也不能替代本輪每筆證據。

## 下一個必要工作

正式四次嘗試的錯誤契約有運作，但不能單靠它保證整批千人情境完成。需實作或確認實際呼叫端的待處理清單、以相同 recognition／order ID 重送、有限退避、永久失敗人工處理，再以真正的呼叫端／Worker 路徑重跑完整三個月。不能只在測試器增加隱藏重試後宣布正式系統通過。

後台目前將一般 409 顯示為「資料已變更或位置已被占用」，尚需针对 RECOGNITION_RETRY_EXHAUSTED 提供相符的重送提示與行為。新認列重試相關變更仍未部署 Stage；本輪沒有發布或改動正式服務。

## 證據

- `C:/UCell/logs/institution-service-scale-20261013.json`：5 情境逐案結果。
- `C:/UCell/logs/institution-service-scale-run-20261013.log`：實際 runner，FAIL 後完成資料庫清理。
- `C:/UCell/logs/institution-service-scale-evidence-20261013.json`：模式、95 次 fixture 重試、三筆 service failure 與進度。
- `C:/UCell/logs/institution-service-scale-audit-20261013.json`：未完成月度稽核，FAIL。
- `C:/UCell/logs/institution-service-scale-abort-audit-20261013.json`：前兩筆失敗認列的唯讀快照。
- `C:/UCell/logs/institution-service-scale-20261013.log`：第一次啟動時資料庫尚未就緒的初始化失敗，保留；不計為產品驗收結果。
- `C:/UCell/logs/institution-service-scale-manifest-20261013.json`：交付雜湊與清理結果。

專用容器與匿名資料卷於驗證測試資料庫為零後移除；無實際收付款、外部通知或 Stage／Production 異動。
