# 後台二元樹全貌

會員營運人員可從「組織管理 → 二元樹」開啟 `/organization/binary`。全貌圖使用後台主題設定，支援淺色、深色及跟隨系統。功能搜尋支援舊名稱「對碰樹」。

原始元件為 `admin/src/features/organization/BinaryMap.tsx`，共用樣式為 `binary-overview.css`。正式映像沿用既有後台及二元樹唯讀 API。執行 `node deployment/binary-overview-theme/prepare.cjs <空目錄>` 可產生 Docker 建置目錄。組裝時會驗證既有後台主程式的 SHA-256，並同步更新延遲載入模組及 HTML 的版本。

執行 `node deployment/admin-ops/qa/binary-overview.cjs` 可透過 Chromium 驗證正式站，`ENGINE=webkit` 則使用 WebKit。`SITE_DIR` 指向已組裝的靜態站時可驗證候選版本，`QA_RESULTS_DIR` 指定驗收紀錄與擷圖的位置。瀏覽器使用合成球位測試資料。正式發布與驗收結果記錄於 `verification.json`。
