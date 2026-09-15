# 本機 Admin DEV 執行

2026-09-15。使用者確認今天採既有 DEV demo 模式、僅本機。目標轉為可實際開啟並操作 Admin；目前完成的是明確標示的只讀 DEV profile，尚未完成所有新增／核准／付款流程，不宣稱完整 Admin 或 Production ready。

前端 http://127.0.0.1:4173/；只讀 API http://127.0.0.1:3001/api/v1；真實 PostgreSQL16 DEV database。沒有 fake data、transpile-only、ts-ignore、dummy replay 或改商業公式。原 production AppModule、Backend Build 與 Release Gates 保留既有 blocker。只讀 profile 的独立 strict TypeScript build 不替代 Backend Build。

## 啟動

先啟動既有 PostgreSQL：在 C:/UCell/UCell/backend 執行 `docker compose --env-file .env.example up -d postgres`。
兩個 PowerShell terminals 分別執行：

```
C:/UCell/UCell/scripts/start-admin-dev.ps1
C:/UCell/UCell/scripts/start-admin-ui.ps1
```

打開上述前端網址，選 DEV：Super Admin。登出已實際測試可回登入頁，重新登入可讀真實 DB 總覽。啟動 script 明確設定 development/demo/read-only、固定 loopback API port3001 與本機 DB。Production、沒有明確 demo 開關、非本機 DB 均拒絕啟動。API 所有既有寫入 routes 都被只讀 guard 拒絕；前端 command 也拒絕寫入，Workbench POST buttons 停用。

admin/.env.local 是忽略追蹤的本機設定，包含 demo=true、read-only=true、proxy=3001；沒有加入 Entra secrets 或改 production examples。用 scripts 可明確重現環境。DEV demo 不是正式 Backend session；既有 Backend bypass 角色為 SUPER_ADMIN，前端 demo 其他角色只用於頁面角色展示，不能當作正式 RBAC security 驗證。

## 修改與證據

修改前 checkpoint5106b47；readonly profile／runtime 修正前 checkpoint33006ea。
新增 src/admin-dev.ts、tsconfig.admin-dev.json 及 API build/start:admin-dev scripts；DEV profile 重用現有 modules/controllers/services、Prisma schema 與 response envelope，所有非 GET/HEAD/OPTIONS requests 拒絕405。正常 HTTP audit append 保留；沒有寫入正式 monetary result。

實際啟動揭露 MembershipApplicationService 的 OrganizationService DI dependency 沒有在 module imports 宣告；補 OrganizationModule import，正常 Nest 初始化後 PASS。這是純工程錯誤，也改善 production module 的 dependency wiring，未改制度。

Vite config 原只讀 process.env，沒有讀 .env.local 的 proxy；改 loadEnv 並保留 environment variable 優先，實際前端 proxy→3001→PostgreSQL 總覽 PASS。

報表 smoke 首次 GET /admin/ops-ready/reports/operations 未提供日期回500（INTERNAL_ERROR）；改檢查 invalid/missing/reversed dates 後回400。合法期間的 aggregate 邏輯、金額及时间比較邊界未改。三項無效輸入及合法報表重新實測 PASS。

Auth 無 token 時不再沿用未符合 DEV/demo/provider 條件的 cached user，避免停用 demo 後仍顯示舊 demo 登入。正式登入仍用原 session/me 驗證；未測 live Entra。

AppShell 顯示只讀限制與 Production/RC blocked banner，api helper 拒絕 DEV只讀寫入，Workbench 停用 POST buttons。新增啟動 scripts 與真正 DB smoke runner。

## 驗證

smoke-results.json：24 項 HTTP checks PASS（18合法 GET、3無效報表 GET、3寫入拒絕）；獨立 Prisma count 與 dashboard 相符，before/after Person、Order、BonusAward、PvLedger、PayableEntry counts 不變。不是 monetary golden fixture，不宣稱計算驗收。

瀏覽器實測 DEV logout/login PASS；16個導航頁的主標題可見，沒有在觀測中看到 API error；包括 Person、申請、Qualification、商品、訂單、組織、重銷、獎金、退貨、Workflow、付款、文件、Audit、報表、UAT、System。總覽真實計數為0；Audit 顯示實際 HTTP audit records。組織樹/Qualification/award/entity detail 仍缺 fixture，僅验证空清單/未選擇狀態，未捏造五球資料；附件明細仍待資料；重銷方案查詢由 API checks 核對。不把頁面顯示視為所有行為已驗收，也没有替UAT30案例填PASS。

完整本輪 commands、PASS/FAIL 與退出碼見 final/PASS-FAIL-MATRIX.md 和 gate-results.json；raw logs 逐檔保存。完整 Backend Build 仍缺 replayBinary/replayMatching；148TODO 未改；DB Golden 缺 fixture；OpenAPI/正式API HTTP Security/UAT/Release仍 FAIL。Admin Build、現有13實際測試、offline/static/security-policy、audits、Prisma validate/migrations 維持通過。

Prisma generate 首次因運行中 API 占用 Windows query_engine DLL 產生 EPERM，原始 FAIL保留；停止DEV API後 generate PASS，final retry單列。這是工程執行順序，不是 schema 修正；應先generate再啟動 Node API。DEV profile strict build與3個啟動拒絕邊界另列，不取代 formal Release Gate。

## 後續未完成

完整 Admin 新增、申請核准、收款、退貨、結算、付款仍需正式 Backend/replay 契約與完整fixture；目前只讀操作模式不能完成這些工作。需以核准來源確認受影響球、K1/K2 pool scope及跨期carry，才能修復全Backend並驗收寫入。148 executable TODO、正式Entra/RBAC/runtime security、UAT及Release evidence繼續阻塞。没有 merge main、force push、push 或升 RC2。

補充工程修正：6748bc8 checkpoint 後發現繼承 NODE_ENV=development 可令 Vite build 輸出 DEV 行為；新增 admin/scripts/build.mjs 強制 production 並關閉 demo/read-only flags。以父環境 development/demo=true 重跑 build、tests 與 Production preview，確認產物不提供 demo 登入。修正前 build 輸出保留 admin-build-before-hardening.txt。
