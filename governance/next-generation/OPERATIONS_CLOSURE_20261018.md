# 2026-10-18 營運待辦處理

## 已實作與驗證

- CSV 匯出套用報表起訖日期：資格與訂單使用 createdAt，付款批次使用 periodEnd。非法期間、資料集及筆數拒絕；超過上限明確要求縮小期間，不靜默截斷。CSV 文字避免公式執行。
- 完整性警示只對具資格且有正 GPV 快照的一般訂單檢查漏認列；套組的 CONFIGURATION_PENDING 另顯示專門警示，申請費不誤報。警示附繁體中文說明。
- 儀表板說明主檔現況與退出／轉讓歷史的差別；百分比保留一位小數，固定 FROZEN 字樣改為制度版本。
- 匯出／警示 9 項測試、儀表板 5 項測試、Worker／組織事件 16 項測試通過。正式後台型別檢查與建置通過。
- 正式 LINE 權杖由既有 Stage 安全設定讀取，經 /v2/bot/info 確認為 @258vmvsa「UCell宇生國際官方帳號」後接入正式 API。未向會員發送測試訊息。
- 正式 Worker 使用現有正式後端映像建立，單一副本，無公開入口。兩筆 BINARY_TREE_CHANGED 已由 PENDING 轉為 PROCESSED；無重啟。自動週期結算與 LINE 背景訊息功能旗標仍關閉。
- 6 份原檔完成 Google Drive 備份並核對大小及本地 SHA-256；詳見正式文件 manifest。資料夾：https://drive.google.com/drive/folders/1-7DYwA1zeSY64vGdQQPAncXNUTUpbwkN

## 仍需外部資料或後續驗收

- EVERY8D：2026-10-18 16:01 台北時間，正式容器 HTTP 403 / Request blocked；本機相同帳密 HTTP 200、額度 999.00。需廠商排查 Azure 存取路徑，未實際發送簡訊，未啟用通知旗標。
- 五份 TIP 商品 PDF 與事業手冊因 Drive storageQuotaExceeded 無法備份。Git LFS 索引誤傳已清除；原檔仍保留 GitHub／本地。
- 一筆已付款資格套組仍為 BALL_SETUP_PENDING 且認列設定待完成；尚無正式倉庫設定。背景 Worker 上線不代表這些業務設定或自動結算已完成，未任意代填球位或倉庫。
- 會員 2610000005 仍是 NETWORK_MEMBER／DRAFT，未送審；只有身分證正反面，存摺及新簽名仍需會員提供。
- LINE 真實收件、實際紙本簽名與 QR 報到需指定驗收人操作。瀏覽器工具本次無法初始化，未宣稱目視驗收通過。

## 版本保存

舊 party-spouse-control 工作目錄的未提交檔案已備份至本機 closure-20261018/source-backup，另存 SHA-256 清單。舊 Git 缺少部分物件，已從遠端可驗證提交重建物件，保留原檔案與引用。本次修正於獨立分支記錄，沒有把整批歷史未提交變更直接覆蓋 main。

正式部署來源為 production-20261014 與 zh-tw-production-20261017 的既有發布快照，僅套用上述修正，保留已上線的會員簽名、掃描檔、通知與 QR 功能。
