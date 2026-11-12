# 2026-11-12 公司球推薦關係與獎金歸戶

此工具重現 2026-11-12 的指定更正。六顆公司球以各自的二元父球作為直接推薦人。程式逐筆驗證當次的球身分、安置位置與推薦順序，並以兩組預演雜湊核對已結算獎金與 GPV 歸屬。

將本目錄完整放進該版本 UCell API 容器，在目錄內使用容器既有的 Prisma、資料庫程式與連線設定執行。`/app/packages/database/dist` 必須包含這次發布的推薦基準、退貨重算與獎金驗算功能。

| 指令 | 行為 |
| --- | --- |
| `node run.cjs` 或 `node run.cjs --trial` | 在同一筆 Serializable 交易內重現全部寫入與驗算，最後回滾，輸出 `VERIFIED_ROLLBACK`。 |
| `node run.cjs --apply` | 兩組雜湊、五個結算批次、逐筆來源與金額均通過後提交，輸出 `COMMITTED`。 |

正式環境已於台北時間 2026-11-12 10:29:37 完成此操作。以任一指令重送時，工具會查詢既有動作編號 `current-tree-rebase:20261112:six-company-balls`、核對六條關係並回傳 `ALREADY_COMMITTED` 及原收據。在具有更正前資料的還原環境，可用預設演練模式重現交易過程。驗算出現差異會輸出 `REPORT_CHECK_FAILED` 並以非零狀態結束。

`verification.json` 保存本次正式對帳金額及校驗值。在同版本與同截點資料上執行 `node verify-api.cjs`，可用唯讀交易核對業績報表、二元左右區及會員獎金明細。
