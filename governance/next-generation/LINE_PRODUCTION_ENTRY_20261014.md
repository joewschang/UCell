# LINE 官方帳號正式會員入口切換

使用者授權將 LINE 官方帳號改連正式會員前台。帳號經 Messaging API 核對為 `@258vmvsa`。

新選單 `richmenu-f5ef3a7fc29cd575d7539f29bd7494c4` 保留既有四格圖片與點擊範圍，四個網址改為 https://member.ucell.life/、https://member.ucell.life/events、https://member.ucell.life/shop、https://member.ucell.life/faq。預設選單寫入後已回讀比對。舊選單保留，可回復。

Stage Worker 設定 `LINE_RICH_MENU_ENABLED=false`，新 revision `ucell-stage-worker--0000005` 健康且執行中；確認舊 revision replica NotRunning 後才啟用正式入口，避免 Stage 每分鐘自動改回舊選單。其餘 Worker 功能維持原配置。

針對五個使用 Stage LIFF 的既有選單發出批次替換，沒有發送任何訊息。批次最終狀態以證據檔 `progress.phase` 為準。第一次回應未保存 request header，因此使用相同 resumeRequestKey 重試以保留可查詢的批次 request ID。

證據及操作腳本：`C:/UCell/releases/production-20261014/line-production-menu.json`、`line-production-menu-verification.json`、`line-production-menu.cjs`。Token 僅在程序記憶體中讀取與使用，沒有寫入證據。

此項變更僅切換入口。正式網站仍有 ingress IP 限制，LINE/LIFF 登入尚未完成，尚未驗證手機 LINE 端完整登入流程。沒有變更 Stage LIFF endpoint、正式身份驗證設定或解除公開流量限制。
