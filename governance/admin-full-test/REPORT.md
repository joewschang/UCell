# Admin 完整權限操作測試

2026-09-15；rc1-recovered；使用者授權「開完整權限測試，找到問題後直接修正」。僅本機 DEV demo；完整操作的 DB 強制為獨立 ucell_admin_test。原 ucell DEV DB、正式環境與正式 monetary result 未寫入。Production／RC promotion 仍 BLOCKED。

## 使用

目前前端 http://127.0.0.1:4173/，DEV：Super Admin；API loopback3001。兩個 terminals 的重啟入口：scripts/start-admin-full-test.ps1（API）與 scripts/start-admin-full-ui.ps1（UI）。可在 sidebar DEV Actor Person ID 選擇隔離 DB 內既有 Person；空白使用 ADMIN TEST ROOT FIXTURE。切換 actor 後重新整理，以重新讀取查詢結果。不存在／無效 actor 拒絕401。這是明確 DEV 測試身分，不是正式 Entra/session/RBAC 驗收。

本輪先建立 DB，執行原16 migrations及既有 prisma/seed.ts；沒有改schema/migration或商業常數。admin-full-test.mjs 明確標示的非 monetary root Person／Qualification test prerequisite 只在隔離 DB 建立，用來測試缺少 root 時無法操作的 UI；不是核准的五球 golden dataset，不當成正式 root bootstrap 規格。預設 root 為1990生日、LEADER、EFFECTIVE、非Active；沒有自造獎金預期數字。測試訂單與付款金額直接使用既有 application 回傳結果，不由AI計算正式 monetary result。

## 已修復

| 問題 | 證據與修正 |
| --- | --- |
| 建立Person留空生日/Email失敗 | 實際UI回 birthDate/email validation error；PeoplePage 改不送未填選填欄位，同一表單點擊成功，清單出現 DEV UI 測試自然人 |
| 無body POST提交申請回400 | run-10-08-13 log；共用api helper不再為無body request加JSON Content-Type；申請Submit/Approve及reversal等無body操作重新PASS |
| 相同／無效付款期間回500 | run-10-09-19 log；既有SQL CHECK period_end>period_start；UnifiedPayable加前置valid date／strict order驗證，回400；cutoff無效亦回400，合法期間PASS |
| Audit actor身分遺失 | session輸出personId，10處controller錯讀userId；7個controller檔改讀personId；真實DB查PERSON_CREATED確認actorType=USER且actorId=rootPerson |
| DEV demo無可追蹤付款審核actor | DEV專用guard查證隔離DB Person並傳遞actor；同actor雙審仍拒絕422，第二Person後Compliance通過；未改正式guard、授權比例或dual approval規則 |

完整profile重用既有Ledger/Active/RPV/Rule/Bonus/Return/EPV/GlobalPool/Payout/Settlement等module；legacy AdjustmentModule因缺兩個replay方法仍未納入DEV可執行範圍，沒有寫stub、修改公式、transpile-only或掩蓋完整Backend build FAIL。沒有公開bind或外部bank送出。DEV profile strict build與完整Backend build分開列示。

## 操作結果與限制

最新操作runner41項HTTP requests PASS；每次run有獨立timestamp JSON，保留早期400／500。涵蓋Person create、同key replay、不同payload conflict、placement preview、Application draft／submit／approve／approve重送、Qualification detail、雙樹讀取、商品讀取、訂單create／payment-confirmations／重送及查詢、季方案create／get／取消、Return create／重送／reversal／detail、Workflow submit與未付review fee approval拒絕、attachment metadata register／get、payable materialize、invalid cutoff／period拒絕、payout batch／detail、Finance approve、sameactor Compliance拒絕、secondactor Complianceapprove、export／mark-paid、CSV export、integrity查詢、不存在actor拒絕。

額外assertions：Person audit actor正確；idempotency回相同ID與replayed；付款事件僅1筆；Qualification EFFECTIVE；附件metadata可讀。沒有fake assertion／改148TODO。

限制：付款批次沒有可分配獎金，這次驗證空批次狀態／雙審流程，不宣稱非空付款金額計算、recovery offset或銀行執行已驗收。Workflow未確認review fee，approval422為正確拒絕，不把它當核准成功。Subscription只測未來月份取消，沒有已認列RPV reversal／多筆月累計EPV驗收。文件只metadata/hash，沒有外部檔案上傳。原SSOT矛盾golden常數仍列LegacyTestDrift，本輪沒有改制度。Legacy replay與正式五球fixture／148 domain TODO仍未解決。

## Gates、commands 與Git

完整逐命令矩陣在 final/PASS-FAIL-MATRIX.md、gate-results.json；raw輸出各同名txt。Node24/pnpm12、frozen installs、21offline/static/security-policy、Prisma validate/generate/migrate、AdminBuild、現有shared6/API3/Admin4 tests、dependency audits重新執行。完整BackendBuild仍兩處replay方法缺失，test root／TODO／RC因148TODOFAIL；DBGolden缺固定五球；OpenAPI／formal HTTPsecurity／UAT／Release仍FAIL。正式productionAPI未使用partial/staledist启动，DEV41checks不替代正式SecurityE2E或UAT signoff。以DB限制／production／remotehost／bypassdisabled的啟動拒絕檢查另外列出。

為避免WindowsPrismaDLL鎖定，跑Prismagenerate時暫停DEV API，gates後恢復並重跑操作runner。完整Backend／AdminBuild、Prisma、DBGolden、Tests、SecurityPreflight及ReleaseGates均保留實際結果，未以DEV build覆寫Release。

Checkpoint：79ac76b（full測試前）、dbc6546（隔離profile後、workflow修正前）、7f538dc（workflow修正後、actor測試前）。Commands包括docker exec postgres psql CREATE DATABASE、原Prisma migrate deploy/seed.ts、node scripts/admin-full-test.mjs、scripts/start-admin-full-test.ps1、node governance/admin-full-test/run-verification.mjs/finalize.mjs、git status/diff/checkpoint/commit。修改檔案另見git diff／commit：Admin PeoplePage/api/AppShell/build、7controller、UnifiedPayable、admin-dev entry、3start scripts、test runner與證據。無merge main、force push、push或RC2升版。

下一步需正式replay契約、核准五球資料、非空award/payable fixture，才能解除完整Backend與domain golden blockers；再完成真正actor/role Entra RBAC、148TODO與UAT。今天可使用隔離DB的已實作API完整操作功能，legacy adjustment/replay尚不能稱為完整可用。
