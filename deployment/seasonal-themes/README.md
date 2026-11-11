# 會員節慶主題

入口：會員中心 → 我的 → 顯示設定 → 節慶主題。設定以已驗證的 personId 儲存，與球號和深淺色模式獨立。一般會員頁、健康中心及主題探索共用 entry.js 與 season.css。

- API: GET /api/v1/member/season-theme 查詢；POST 同路徑，傳送 { "theme": "classic|christmas|newyear|lunar" } 或 { "sync": true }。不接受用戶端指定帳號來切換其他人的選單。
- LINE: 僅對會員已綁定的有效 LINE identity 操作。保留原有個人選單，遇到外部變更時，切回經典不移除外部選單。未綁定時儲存網頁偏好；綁定後下一次開啟會員中心同步。傳輸失敗顯示待同步並提供重試。
- 圖稿：import-menu-art.ps1 -InputDirectory <原圖目錄> 將指定的三張 PNG 完整縮放為 1280 × 864 JPEG；art/menu-*.jpg 同時用於前台預覽與 LINE。四格沿用原本入口，每款依圖面分隔線設定點擊區域，不含公司署名。render-art.cjs 僅生成網頁裝飾橫幅。
- 發布：以兩份 Dockerfile 指定的正式映像為基礎，由本目錄作為 build context。先發 API，在新修訂版的 Node 執行 require('/app/apps/api/dist/season/provision.cjs').run()，通過 OA 身分、尺寸、區域、網址與圖片讀回驗證後，再發前台。provision 保留全體預設選單；三張圖片和連結皆讀回驗證後才一起更新對應。已有節慶選單的綁定會按個人偏好重新同步，舊選單編號保留以支援還原。
- 驗證：node --test test.cjs；安裝 @electric-sql/pglite 後執行 node verify-db.cjs；用 patch.cjs 處理前台 webroot 並複製 /seasons/v1 靜態資源後，以具有 playwright-core 的環境設定 CHROME，執行 node verify-ui.cjs <webroot>。測試涵蓋三主題、還原、失敗重試、帳號隔離、跨頁及深淺色。
