# 會員節慶主題

入口：會員中心 → 我的 → 顯示設定 → 節慶主題。設定以已驗證的 personId 儲存，與球號和深淺色模式獨立。一般會員頁、健康中心及主題探索共用 entry.js 與 season.css。

- API: GET /api/v1/member/season-theme 查詢；POST 同路徑，傳送 { "theme": "classic|christmas|newyear|lunar" } 或 { "sync": true }。不接受用戶端指定帳號來切換其他人的選單。
- LINE: 僅對會員已綁定的有效 LINE identity 操作。保留原有個人選單，遇到外部變更時，切回經典不移除外部選單。未綁定時儲存網頁偏好；綁定後下一次開啟會員中心同步。傳輸失敗顯示待同步並提供重試。
- 圖稿：render-art.cjs 生成三組有相同插畫的選單和橫幅。正式版使用 art/ 內的 JPEG；四個觸控區和網址沿用既有 OA 預設選單。
- 發布：以兩份 Dockerfile 指定的正式映像為基礎，由本目錄作為 build context。先發 API，在新修訂版的 Node 執行 require('/app/apps/api/dist/season/provision.cjs').run()，通過 OA 身分、尺寸、區域、網址與圖片讀回驗證後，再發前台。provision 不設定全體預設或綁定任何個人。
- 驗證：node --test test.cjs；安裝 @electric-sql/pglite 後執行 node verify-db.cjs；用 patch.cjs 處理前台 webroot 並複製 /seasons/v1 靜態資源後，以具有 playwright-core 的環境設定 CHROME，執行 node verify-ui.cjs <webroot>。測試涵蓋三主題、還原、失敗重試、帳號隔離、跨頁及深淺色。
