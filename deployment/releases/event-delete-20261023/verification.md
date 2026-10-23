# 活動刪除 — 2026-10-23

後台活動管理每張卡片新增「刪除活動」，展開確認區顯示活動名稱、報名數、刪除效果。輸入相符活動代碼與原因才可送出；取消、處理中、失敗提示、成功移除及捲回結果提示均已實作。草稿、已發布、已封存均支援。

採邏輯刪除：learning.member_event_deletion 保存刪除人、時間、原因，原活動設為 ARCHIVED。同一交易中停用原活動通知並寫稽核。活動代碼不重複使用。前後台活動清單隱藏、會員詳情不可存取，公開分享及官網既有 PUBLISHED 條件使活動下架；阻止編輯、發布、提醒、報名與報到等後續操作。報名、參與證據保留；管理員仍可由既有會員紀錄／名冊 API 查核。既有統計與歷史出席證據不抹除。沒有對任何既有活動實際執行刪除。

API POST /admin/events/:eventCode/delete，沿用活動管理角色 SUPER_ADMIN、MEMBERSHIP_OPS、ORDER_OPS 及 IdempotencyGuard。交易鎖定活動，重試不重複寫稽核。資料庫 migration 20261023150000_event_delete 有交易與 checksum 保護，啟動前套用。

## 驗證
- API Nest build、後台 TypeScript app 檢查、正式環境前端 build 通過；Entra 與 API 正式設定驗證通過。
- Edge browser-qa.cjs：代碼錯誤禁止確認、錯誤訊息、重試成功、活動消失及成功提示。
- 正式 API 容器 verify-rollback.cjs：真實 PostgreSQL 交易測試草稿／發布／封存刪除、確認碼拒絕、冪等、會員及後台清單移除、詳情／報名／報到／憑證／發布拒絕、名冊保留、通知退休、稽核只有一筆。測試資料全部回滾，腳本輸出 EVENT_DELETE_ROLLBACK_QA_PASSED。
- 正式 HTTP health 200、匿名刪除請求 401。後台新版 bundle /assets/index-8xReZj-D.js 內容確認包含刪除操作。
- API 與 admin 最新版本 event-delete-20261023 均 Ready，100% 流量。

## 部署
- API sha256:ff5b0fa03262767c86c7aa32ac2c2b21265618548a6baea8bd31bd5876a4e149
- Admin sha256:4d966cb51442b3f447bfe2fa65ccaea097b3b29ce0a36679287877a6819fe4e2
- 從既有正式映像增量覆蓋；已比較 live events controller/service，差異僅本次功能。會員網站與官網映像無需更新。
