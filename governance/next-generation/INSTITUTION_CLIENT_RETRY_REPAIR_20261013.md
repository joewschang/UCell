# 認列 409 呼叫端重送修正

日期：2026-10-13。**FORMAL_CLIENT 千人三個月驗收通過**；本次未部署 Stage。

## 問題與修正

前輪正式 API 在四次 Serializable 交易嘗試耗盡後，正確回傳可重送的 409，且已核對的失敗交易沒有部分提交。但後台命令只做單次呼叫，並把錯誤顯示為一般資料衝突，無法自行恢復這種暫時衝突。

新增 `shared/recognition-request.ts`，正式 Admin 的 command client 與規模測試共用同一套有限次重送程式。僅允許 EPV／RPV 的認列路徑，而且同時符合 HTTP 409、RECOGNITION_RETRY_EXHAUSTED、retryable=true、attempts=4 才重送。最多四次請求（首次加三次再送），退避時間為 500–999、1000–1499、2000–2499 毫秒。服務內原本的四次交易嘗試維持不變。

每次保留相同業務 ID、命令識別碼及送出前固定的資料；同時點擊合併成同一個請求。退避後重新檢查登入身分，切換身分即停止。四次請求耗盡仍回報失敗，保留原識別碼供使用者在同頁稍後重試；不是無限迴圈，也不是跨頁／跨程序持久化工作佇列。

這項行為接入 Admin 共用 command client。現有訂閱頁仍是唯讀，未新增認列按鈕或解除原營運設定限制；不能據此宣稱管理員已有完整可視化工作處理頁。Worker 既有下次輪詢恢復路徑未在本輪修改或納入千人模擬，永久失敗工作的隔離／人工處理與實際營運入口仍待整合。

連線不明、逾時、一般 409、驗證／權限錯誤與其他財務操作不自動重送。後台對此特定耗盡結果顯示明確的同筆重試提示。不變更金額、公式、資料庫隔離等級或正式交易重試上限。

## 驗證範圍

- Admin 全套 258 案 PASS；其中命令識別碼與新重送策略共 15 案，含保留資料／識別碼、雙擊合併、有限次停止、錯誤分類與身分切換。Admin TypeScript 與 build PASS（既有 bundle 大小警告仍在）。
- HTTP 10 案 PASS：RPV／EPV 使用真實 localhost HTTP、正式 Controller／Service／ExceptionFilter，驗證首請求四次交易衝突回 409，共用 client 再送相同 URL 後成功。此組交易為故障 stub，並非實際財務提交；資料庫正確性由規模案例與其獨立 audit 驗證。沒有載入完整 App 登入 guards。
- API 測試 TypeScript PASS。
- `FORMAL_CLIENT` 規模模式共用正式 client helper，僅將 service exception 轉換成其 HTTP error shape。每一筆認列仍呼叫正式 EPV／RPV service 與真實 PostgreSQL；並非千人真實瀏覽器或跨網路 HTTP 負載。
- Active fixture 原有測試器重試、正式 client 再送分開記錄。正式 helper 內部交易重試總數未加 instrumentation，不臆測總次數。

## 規模結果

4 個並行工作，1,000 位會員分批 400／350／250 加入，2024 年 1–3 月合成情境：**5 案 PASS／0 FAIL／0 SKIP**。獨立唯讀資料庫 audit 三個月份全部 PASS。

| 月份 | 有效會員 | EPV 可付計算 | RPV 可付計算 |
|---|---:|---:|---:|
| 1 月 | 400 | 127,603.20 | 171,200 |
| 2 月 | 750 | 231,098.40 | 376,300 |
| 3 月 | 1,000 | 305,925.60 | 516,200 |

逐月 10 個數值欄位及完整季度摘要另以程式比對原單工基準，全部相同。EPV 10,283 筆＋RPV 24,894 筆＝35,177 筆獎金明細；合計模擬可付 1,728,327.20，非實際付款。172 次 EPV＋210 次 RPV 抽樣重送均不增加業績、獎金或通知。2,092 筆會員通知、58 筆取消期數保護及後續 850 期未處理狀態符合預期；沒有外部通知發送。

正式 client 額外再送 **1 次**後成功；最終未恢復 serviceFailures 為 0。Active fixture 測試器交易重試 **113 次**，不混算為正式 client 或服務內部重試。原本 SERVICE_ONLY 的 1 PASS／4 FAIL 保留，不改寫成成功。

Jest 耗時 1,092.718 秒（約 18.2 分鐘）。本輪 PostgreSQL 保留預設 fsync；前輪曾使用 fsync=off，不能直接據此比較正式環境效能，也未驗證斷電持久性。162 項資料庫初始化斷言 PASS，不因多次執行累加。

兩個執行程序正常結束；isolated runner 清除測試資料庫，確認剩餘零個後移除專用容器與匿名資料卷。

## 證據

- `C:/UCell/logs/institution-client-admin-20261013.json`
- `C:/UCell/logs/institution-client-http-20261013.json`
- `C:/UCell/logs/institution-client-typecheck-20261013.log`
- `C:/UCell/logs/institution-client-scale-20261013.json`
- `C:/UCell/logs/institution-client-scale-evidence-20261013.json`
- `C:/UCell/logs/institution-client-scale-audit-20261013.json`
- `C:/UCell/logs/institution-client-scale-comparison-20261013.json`：與原基準比對。
- `C:/UCell/logs/institution-client-repair-manifest-20261013.json`：來源／證據雜湊與清理結果。

前輪 SERVICE_ONLY 失敗證據保留。本次即使通過，也只代表透過正式 client 策略能完成該合成情境，不代表 SERVICE_ONLY 不再耗盡、永久失敗工作處理已完成、全制度年度帳鏈已驗收或 Stage 已更新。
