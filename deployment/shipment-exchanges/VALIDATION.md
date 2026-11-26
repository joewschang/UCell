# 出貨單退換貨驗證紀錄

驗證日期：2026-11-26（Asia/Taipei）。來源基準：`d959e7af1bd5721893e86c89b614f43a5dea24fd`。

## 已執行結果

| 檢查 | 結果 |
| --- | --- |
| Node 24、pnpm 12.4.1，依既有 lockfile 安裝 | 通過，未修改依賴版本 |
| Prisma Client generation、Database build、API build | 通過 |
| Admin TypeScript 與 production build | 通過 |
| Admin 受影響測試 | 4 suites、27 tests 通過 |
| API 最後整合回歸 | 15 suites、90 tests 通過 |
| PostgreSQL 16.16 migration | 153 migrations 全數套用，包含新增換貨 migration |
| 原資料庫基線 | 162 assertions 通過 |
| Schema、migration、enum migration preflight | 通過 |
| OpenAPI generation、preflight、security scan | 通過 |
| Git whitespace check | 通過 |

API 整合測試包含換貨生命週期、並行與財務交叉邊界、既有出貨 HTTP／掃描／配置／序號追溯／並行保護、同 SKU 替代退貨、部分重銷退貨、安置前退貨、資格套組、月配方案與入會優惠券。

所有資料庫測試均使用本機隔離資料庫和合成資料；每個測試檔建立獨立資料庫，結束後清除。這份紀錄不代表正式站已完成 migration、發布或現場驗收。

## 核心通過情境

1. 同 requestKey 的並行申請回傳同一案件；改變內容不能重用該 requestKey。
2. 同序號不能同時取得兩份有效換貨權利，其他訂單或未實際出貨的序號會被拒絕。
3. 可分批驗收；未收齊不能補寄；重複驗收不會增加數量。
4. 並行建立補寄只產生一張補寄出貨單，原訂單、金額、商品用途及原序號證據保持不變。
5. 未驗收案件可取消重開；已收到商品的案件不能直接取消，歷史案件不可刪除。
6. 財務退貨與換貨建立並行時只有一條有效流程；同 SKU 跨行替代驗收後也不能超過剩餘權利數量。
7. 不相關商品行可正常退貨。補寄出貨後，新序號可以再退貨或再換貨，舊退回序號不能重複消耗退貨額度。
8. 普通出貨不能使用換貨專屬的額外配置額度；退回商品不會自動恢復為可售序號。
9. 前端處理唯讀角色、在途重送、舊查詢取消、狀態更新後的失效選取及原訂單精準帶入。

## 可重現命令

使用本機臨時 PostgreSQL 的控制連線設定 `DATABASE_URL`，依專案既有隔離測試程式建立、驗證及清理測試資料庫。

```bash
# 在 backend/ 執行
pnpm db:generate
pnpm --filter @ucell/shared --filter @ucell/contracts --filter @ucell/database --filter @ucell/settlement build
pnpm --filter @ucell/api build
pnpm test:api:isolated --testPathPatterns='shipment-exchange|fulfillment-(http|source-allocation|serial-provenance|concurrency|serial-scan)|return-substitution-closure|test.repurchase-partial-return|return-pre-placement|a-decision-return|entry-coupon-db|package-monthly-schedule-db|package-posting-boundaries-db|qualification-return-activation'
pnpm schema:preflight
pnpm migration:preflight
pnpm enum:migration:preflight
pnpm openapi
pnpm openapi:preflight

# 在 admin/ 執行
pnpm exec vitest run src/features/fulfillment/FulfillmentExchangeForms.test.tsx src/features/fulfillment/FulfillmentPage.test.tsx src/features/fulfillment/FulfillmentShippingForms.test.tsx src/features/returns/ReturnsPage.test.tsx
pnpm build
```

## 生成契約範圍

以獨立 checkout 重新生成 `d959e7a` 的契約，再與本次生成契約逐項比較：只有四個換貨 POST 端點、既有訂單搜尋新增可選 `orderNo`、兩個新 DTO，以及版本 `1.1.0 → 1.2.0`。沒有刪除端點或 schema，沒有其他既有 operation、schema 或 security 變動。

原本追蹤的 JSON 已落後於原始碼：原追蹤檔為 318 paths／211 schemas，基準原始碼重新生成為 374／223，本次為 378／225。因此生成檔較大的文字差異包含既有原始碼的同步；未修改受控 baseline 或放寬治理規則。

SwaggerHub 仍依既有決定暫停發布。本機結果不等同 GitHub hosted CI、完整發布治理或 Azure 正式環境驗證；正式部署須依 `deployment/PRODUCTION.md` 保留實際發布證據。
