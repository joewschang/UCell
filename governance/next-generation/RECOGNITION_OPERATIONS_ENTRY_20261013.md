# 認列營運入口驗證 — 2026-10-13

## 本輪完成

- 訂閱詳情新增既有到期 RPV 排程的確認執行／重試入口。僅 Super Admin、FINANCE 可操作；未到期、日期無效、已認列、已取消排程不能從此入口送出。
- 沿用既有 command client 的同筆命令合併、有限交易衝突重送及工作階段檢查；不新增排程、不改訂閱日期、不開放訂閱新增或取消。
- 操作後刷新訂閱明細及清單。失敗保留錯誤訊息，要求使用者先重新查核狀態；查核失敗時仍鎖住重試。成功與狀態刷新失敗分別顯示，避免將讀取失敗當成認列失敗。
- RPV POST 的角色政策改為 SUPER_ADMIN、FINANCE；COMPLIANCE_AUDIT 保留 GET 獎勵明細查閱。

## 驗證證據

- Admin：267 / 267 PASS，`C:/UCell/logs/recognition-operations-admin-final-20261013.json`。
- HTTP：11 / 11 PASS，`C:/UCell/logs/recognition-operations-http-20261013.json`。新增測試使用真實 AdminRoleGuard 驗證拒絕稽核／客服寫入、未登入 401、財務／Super Admin 寫入及稽核讀取。測試 principal 注入取代登入，業務服務為 stub，不能代表完整登入或真實資料庫驗證。
- Admin `pnpm typecheck`、`pnpm build` PASS。建置仍有既存大於 500 kB 的 bundle 提示。
- 第一輪 Admin 因既有訂閱頁測試匯入新增元件後缺少 auth mock，出現 `window is not defined` 的 suite 載入錯誤；已補 mock 並重跑全套。第一輪記錄保留，不能用其 266 assertions 全過宣稱整套成功。

## 範圍與未完成事項

- 本輪未重跑千人三個月模擬；該結果仍以 `INSTITUTION_CLIENT_RETRY_REPAIR_20261013.md` 與其證據為準。
- 未部署 Stage，未完成真實瀏覽器操作 UAT。
- 此入口沿用現有確認元件，確認理由不另存正式 Audit，畫面明示此限制；尚未新增人工處理原因／結果的持久化紀錄。
- Worker 的永久錯誤仍沒有持久化失敗佇列、退避或隔離。其優先取前 20 筆待認列資料的流程仍存在阻塞後續排程的風險，須另外設計與驗證，不能視為本輪已修復。
- 本輪沒有更動 EPV 權限或加入 EPV 操作介面。完整年度八獎金與制度覆蓋驗證仍未完成。

## 下一步

先補 Worker 失敗紀錄與排程公平性：區分可重試交易衝突與需人工修復的錯誤；使用可查核、可恢復的狀態與退避，保留原認列排程及唯一性保障。測試必須包含前 20 筆全失敗時第 21 筆仍可處理、重啟保留失敗狀態、修復後重試與不重複發獎。
