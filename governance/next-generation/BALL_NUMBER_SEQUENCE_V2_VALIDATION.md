# Ball Number V2 實作與驗證紀錄

日期：2026-09-25（Asia/Taipei）。規則見 [BALL_NUMBER_SEQUENCE_V2.md](BALL_NUMBER_SEQUENCE_V2.md)。

## 已完成

- 起始三球使用專用 `bootstrapBallNoFor`，一般球改由資料庫 `allocate_ball_no` 配發每樹獨立序號。
- 新增 Prisma 配號紀錄／計數器模型與 forward migration `20260925120000_ball_tree_sequence`。
- 保留原有球號唯一、不可變更及二元樹位置限制，將一般球完整性驗證改為配號紀錄比對。
- 舊號以完整樹代碼拆出尾碼回填，計數器以最大尾碼初始化；配號紀錄區分歷史及 V2 規則。
- 安置預覽回傳 `expectedBallNo: null`，Admin 顯示「成功安置後依該樹序號配發」，正式收據顯示已配號結果。
- 更新 README、P0 決策、資料字典、P0 報告與資料重建檢核腳本。

## 驗證結果

| 項目 | 結果 |
|---|---|
| Prisma generate / validate | PASS |
| Database package build | PASS |
| API build / build:admin-dev | PASS |
| Schema / source / migration preflight | PASS |
| 全新隔離 PostgreSQL migration | 84 migrations 全部成功 |
| 隔離資料庫基礎檢核 | 154 assertions PASS |
| business-identifiers、p0-identifiers-db、binary-tree-db | 3 suites，45 tests PASS |
| Admin BinaryTreesPage | 20 tests PASS |
| Admin typecheck / production build | PASS；Vite 有 bundle 大小提示，無建置錯誤 |
| 本機 ucell 與 ucell_admin_test 球號重建檢核 | PASS |

整合驗證包含：同樹 16 筆並發配號唯一、跨樹獨立、重試不增號、跨樹重配拒絕、起始球不可使用一般配號器、配號紀錄不可刪除、交易回滾、序號超过六位、深層位置仍按配號順序、預覽無配號、會員移轉公司與再轉讓保留球號。

既有資料升級演練在隔離資料庫交易中重新執行實際 migration SQL，驗證所有已發布球號不變、計數器等於各樹最大既有尾碼、回填版本為 `LEGACY_POSITION_V1`，演練交易回滾，隔離資料庫於測試結束清除。

## 實際套用範圍

- `127.0.0.1:5432/ucell`：已套用本次 BallNo migration。
- `127.0.0.1:5432/ucell_admin_test`：已套用本次 BallNo migration，Prisma migration 紀錄確認完成。
- 使用本次專用本機 migration 工具，未一併套用其他功能的 pending migrations。
- 套用前兩個本機資料庫均無已配號球／樹；既有資料保留行為由上述隔離整合測試驗證。
- 備份位於 `C:\UCell\backups\ball-sequence-v2\ucell-before.sql` 與 `ucell_admin_test-before.sql`，不加入版本庫。
- API、Admin 建置輸出已更新；沒有啟動或重啟服務。檢查時未發現既有 `dist-admin-dev/admin-dev.js` 程序。
- 未連線、遷移或部署遠端 Stage／正式環境。

正式部署仍須按規則文件暫停安置寫入、備份、套用 migration 並部署相容 API，避免舊版位置配號程式與新版資料庫規則混用。
