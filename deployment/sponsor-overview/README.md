# 推薦樹全貌

後台「推薦樹」(`/organization`) 會先顯示全部推薦起點。點球可查看球 360，選「以此球為起點」可只看這顆球與其下線；頁面原有的球號、姓名、手機搜尋與逐層清單仍可使用。「顯示全樹」調整縮放，「返回全部推薦樹」則取消支系篩選。

全貌以同一截點讀取有效推薦線（生效時間含、失效時間不含），包括未關閉或作廢且已編球號的球，以及有效推薦線的兩端。球位的識別鍵是資格 UUID；名稱、球號、對碰樹位置都不能用來合併節點。每組直推以推薦序號、建檔時間及 UUID 排序。API 為唯讀，資料有循環、同時有兩個上線或缺少端點時應回傳 409，不繪出部分結果。

## 驗證及發行

- 介面與佈局原始碼位於 `admin/src/features/organization/`；後端位於 `backend/apps/api/src/modules/admin-observability/sponsor-map.controller.ts`。
- 在 admin 執行 `vitest run src/features/organization/sponsor-map-layout.test.ts`。資料庫整合測試 `backend/apps/api/test/sponsor-map-db.e2e-spec.ts` 會建立測試資料，僅可在隔離的測試資料庫執行。
- 從 repo 根目錄執行 `node deployment/sponsor-overview/api/prepare.cjs <空的 API 建置目錄>` 及 `node deployment/sponsor-overview/prepare.cjs <空的後台建置目錄>`。各目錄含獨立 Dockerfile，分別沿用指定版本的正式 API 和後台。若基底雜湊不吻合，請先重新比對現行路由及模組，不要移除保護檢查。
- 用 `deployment/admin-ops/qa/sponsor-overview.cjs` 驗收；設 `SITE_DIR` 可測組裝後的候選站，省略則測正式站靜態資源。此測試攔截 API 並使用合成資料，實際部署的 API 與正式資料必須另外唯讀驗證。
- 先發布 API、確認健康及資料完整性，再發布後台。兩者均使用 `deployment/publish-production.ps1` 及經核對的映像 digest、目前 revision。
