# 正式會員協議換版

本次將 `FORMAL_MEMBERSHIP` 從 `INDEPENDENT-20261029` 換為 `DIRECT-PLACEMENT-20261112`。新版只替換手冊「永久安置序位規則」中指定安置方向的一句話。

> 直接推薦之資格，得於該推薦資格子樹之合規範圍內，自選左側或右側合法空位。

| 版本 | 本文 SHA-256 |
|---|---|
| INDEPENDENT-20261029 | `e70c02cc9a45bcb6f5c1c2baebd7d3122b16635526f8a8d6e0137ef4a343977c` |
| DIRECT-PLACEMENT-20261112 | `5933d26cb37f38233386f64265d2e875dce949f9dd5b3f244a08fb62982e9d4e` |

在可載入正式 API Prisma Client 的容器內依序執行三個指令。

```sh
node release.cjs trial
node release.cjs apply
node release.cjs verify
```

`trial` 在交易內實際演練換版後回滾。`apply` 比對舊版內容和雜湊，在 PostgreSQL 同一交易持有文件表專用鎖，依 2026-10-29 發布程序暫停文件不可變觸發器，僅更新舊版有效截止時間，隨即恢復觸發器。新版取得獨立文件 ID，其生效時間與舊版截止時間相同。既有同意及簽署證據繼續指向原文件 ID 與原雜湊。

`verify` 使用唯讀交易核對新舊本文、共同切換時間、唯一現行版本及觸發器。連線中斷或回覆遺失時先執行 `verify`。如已發布，會回傳 `published` 與原本的切換時間。若仍為舊版，重跑同一個 `apply`。若腳本報告來源雜湊或目前版本有差異，依實際版本查核。

本機回歸測試以 `DATABASE_URL` 指向已有資料表、尚無正式會員協議的本機測試標本資料庫。執行 `node test.cjs` 會建立獨立副本，驗證模擬發布、並行執行、有效期邊界、同意證據與防竄改，完成後移除副本。
