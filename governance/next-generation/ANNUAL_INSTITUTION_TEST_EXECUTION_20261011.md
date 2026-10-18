# UCell 制度與年度模擬測試執行紀錄

日期：2026-10-11（Asia/Taipei）。驗收狀態：**PARTIAL_VALIDATED；尚非完整制度年度端到端驗收**。

## 結論與執行範圍

已實際執行隔離 PostgreSQL 回歸，並新增四組跨年度測試。八類獎金均有本次執行的個別既有案例；新增年度證據涵蓋 Active、EPV、預繳 RPV 及六類結算工作探索。不能把案例數當作制度條款覆蓋率，也不能將排程工作成功建立當成結算與銀行付款成功。

最終完整回歸結果：**223 組、1,558 案 PASS，0 FAIL、0 SKIP、0 TODO**，耗時398.574秒。包含原有216組／1,537案、新增四組年度18案、納入預設清單的三組經濟整合3案。Calendar精確212工作計數另在補充回歸通過，不重複計入總數。

另外，shared 模組 5 組／181 案 PASS，真實資料庫基礎檢查 162 項斷言 PASS，12 個月未活躍判定 8 案 PASS。162 項基礎斷言在每次初始化都會執行，報告只計一次。contracts/database/worker 的 package test 命令是 `no-tests`，不計為測試通過；Worker 的本次有效證據來自 API 測試中實際呼叫 Worker 及程序故障案例。

後端全套 build 與 `tsc --project apps/api/tsconfig.e2e.json --noEmit` 已通過。公式 sanity script 與 TODO gate 通過；公式 script 是獨立簡易算術檢查，不等同正式引擎或全制度驗算。

## 隔離與證據邊界

- 原始碼：`C:/UCell/worktrees/party-spouse-control`，包含工作區既有未提交變更；本次不是已部署 Stage 版本驗收。
- 使用本次建立的 `ucell-annual-test-20261011` PostgreSQL 16 容器，僅 loopback port 55439；測試器逐 suite 建立隨機命名資料庫、執行真實 migrations，最後刪除。
- 使用合成會員、球、訂單與規則。未寫入 Stage／Production，未執行銀行匯款或真實通知發送。
- 日期採 2024-01 至 2025-03 的歷史合成業務日期，涵蓋閏年與跨年。設計原訂 2027–2028 的可注入時鐘尚未實作；本次不改系統時鐘，不宣稱付款成熟化／租約時間也已快轉 15 個月。
- Active 與 EPV／RPV 為不同隔離情境；EPV／RPV 的資格歷史、Active 與組織關係由 fixture 建立，沒有宣稱完整註冊→購買→Active→獎金的同一條年度資料鏈。
- EPV 呼叫正式 service；RPV 呼叫正式 SubscriptionService、RpvService 與 Worker `processRecognition`，不是直接插入 Award 模擬通過。Calendar 呼叫正式 planner，但沒有執行其全部年度 jobs。
- 為縮短大量測試資料庫重建，容器中途將 `checkpoint_completion_target=0`、`fsync=off`；最後一輪使用此設定。交易、約束、鎖與重送仍由 PostgreSQL 驗證，本輪**不驗證資料庫主機斷電／儲存設備故障的持久性**。synchronous_commit 保持 on。

## 新增年度案例

| 案例 | 合成情境與獨立期望 | 驗證邊界 |
|---|---|---|
| ANNUAL-ACTIVE-00～14 | 15 個月份各自輸出一個 Jest 結果。每月 1,999 未達標、再 1 達 2,000；達標前 1ms 不活躍、達標當筆生效、次月 00:00 失效；同主體另一球的 1,999 不合併；重送不重複產量 | 正式 recognition function + DB。輸入量是 GPV fixture，不能據此聲稱現金／點數分類已驗收 |
| ANNUAL-EPV-01 | 每月主球 1,500＋1,500，另一球 1,500；主球 EPV=600、另一球=0。主球自領300，Sponsor五代各36；G3只在2024年7月失活且不補位。15月共45筆EPV事件、195筆獎金，EPV合計9,000，獎金合計7,164；逐筆及整年重播不增加筆數 | 真實 EpvService + DB；現金訂單基礎由 fixture 設定，未覆蓋全部支付組成。明確斷言門檻2,000、比率60%、自領50%、上線各6% |
| ANNUAL-RPV-01 | 年繳24,000／12期，加下一季6,000／3期；實際服務建schedule，建立時零RPV，每月認列1,200。13層Binary；0直推只解鎖5代，G6–12為零、G13不建立；G3單月失活，其後代別不壓縮。15期RPV總18,000、180筆上線事件、可付7,400 | API service／Worker function交替認列及交叉重送，每期僅1事件與1站內訊息，外部delivery為0。沒有驗證實際貨運8／2盒或真實付款 |
| ANNUAL-CALENDAR-01 | 2024-01-10 至2025-03-25台北時間；逐月推進與一次補跑得到相同工作身分、先決工作與outbox；重跑不新增。獨立邊界期望：K0／付款準備各29期、Binary／Matching各63週、Global／Welfare各14月，共212 jobs／情境 | 正式 planner + DB，兩組情境；每週保持完整7日並於週日結束。只驗證admission／依賴，不表示212份工作都已完成付款 |

原始案例位於 `backend/apps/api/test/annual-*-simulation-db.e2e-spec.ts`。

## 八類獎金本次已有的執行證據

以下僅列具體代表案例；逐案名稱與結果以 JSON case catalog 為準。表內有些檔案共享，不能將各列案例數加總為獨立條款數。

| 獎金 | 已執行內容 | 主要測試來源與限制 |
|---|---|---|
| REFERRAL 推薦 | G1三方案15／20／25%、Active、歷史來源、與對等共享42% K0 | `bonus-engine-v04`、`gpv-immediate-effects-db`、`period-eligibility-lineage-db`；混合mock service與DB，部分DB案例為合成參數 |
| RETAIL_REFERRAL 零售推薦 | 不可變商品比例快照、Active／Inactive、部分及全退、重送 | `retail-referral-db.integration.e2e-spec.ts` 的4案；不代替每個正式商品配置驗收 |
| EQUALIZATION 對等 | 三方案固定代別比例、使用G1推薦母數、解鎖、不壓縮、K0共池 | `bonus-engine-v04`；未把全部代別、版本、所有年度事件組合逐一展開 |
| BINARY 對碰 | Binary子樹、弱邊、週上限、雙邊扣量、Carry、12%、36% K1、Inactive | `bonus-engine-v04`、period close與162項DB檢查；尚非同一組織連續63週Carry與退貨總帳驗算 |
| MATCHING 輔導 | K1後Binary實際權益母數、Sponsor五代比例／解鎖、Inactive不壓縮、15% K2 | `bonus-engine-v04`、period close與DB重播；母數不是銀行已付現金 |
| RPV 重銷 | 逐期／跨年認列、5代邊界、部分退款／累計追回、API與Worker去重、公司流向 | 新增annual RPV、`test.repurchase-partial-return-db` 12案、`matured-payable-company-rpv`、company volume整合；8／12代與每種預繳組合的完整年度流程仍待展開 |
| EPV 超額消費 | 月累計、4800→1680、50%＋五代6%、球別、歷史Active、重播、退貨與公司流向 | 新增annual EPV、`epv-lineage-closure-db`、`epv-global-v05`、162項DB斷言及company volume整合 |
| GLOBAL 全球分紅 | 5%池、級別門檻、累積級別、當月資格、未分配進A、不可變與重送、會員付款／追回及公司分流 | `epv-global-v05`、`global-pool-calculation/persistence/reservoir-db`、member/company economic整合；不把fixture比率當作核准參數真值 |

相關完整回歸另外包含：period close job 22案、Worker程序故障24案、planner6案、遲到輸入4案、付款結果／追回21案、營業日付款日曆7案；均需以最終 JSON 查核，而非僅憑檔名認列。

## 測試過程發現與修正

1. 三組 `*.integration.ts` 經濟測試未被預設 Jest regex 收錄。本次加入明確的三檔白名單，保留容量測試的獨立執行方式；最終 discovery 應為223 suites。
2. `company-volume-economic.integration.ts` 仍以3球bootstrap假設安置在#2左側。現行7球配置該位置已有球；改用#4左側，RPV公司祖先數由2改3。維持占位保護與一、三推薦左線限制，未修改制度程式來迎合測試。
3. 測試型別檢查發現既有20項診斷：type-only re-export、controller fixture少依賴、陣列／mock型別、unknown回傳及文字／binary artifact union未收斂。已以明確型別、回傳結構斷言及文字artifact守衛修正；未改獎金公式。
4. 新增測試開發時曾發生 PrismaClient 匯入、subscription回傳包裝、缺少accounting.timezone fixture等錯誤；修正後重跑。初始 FAIL log 保留，不覆寫成 PASS。Calendar JSON prerequisite型別亦已加結構檢查。

## 尚不能宣稱完成的制度驗收

| 項目 | 狀態 | 完成所需證據 |
|---|---|---|
| 全部核准文件與Rule／Decision Register逐條追溯 | NOT_IMPLEMENTED／待盤點 | 報備文件、核准參數、來源章節、每個條件與caseId一一對應，確定覆蓋率分母 |
| 同一組織的八獎金全年＋三月收尾 | NOT_IMPLEMENTED | 同一事件流經API、outbox、獨立Worker、全部結算、成熟化、付款結果與追回；逐期獨立Oracle和總帳守恆 |
| 可注入業務／收件／處理三時鐘 | NOT_IMPLEMENTED | 遲到、乱序、租約、營業日成熟化與年末義務的可重現排程；本次歷史日期不能取代 |
| 所有方案／代別／精度／退貨狀態交叉矩陣 | PARTIAL | 現有個別案例已跑，但每个制度細節仍需獨立展開，不以共享大案例宣称完整 |
| 300主體／600球年度與容量階梯 | NOT_RUN | 固定seed事件清單、全部月／週結算、效能與資料守恆報告 |
| 真實銀行格式受理／實際假日配置、配送與通知送達 | BLOCKED_EXTERNAL／待另驗 | 外部sandbox或對方回执，與測試環境分開驗收 |
| 主機斷電、PostgreSQL復原及儲存持久性 | NOT_RUN | fsync開啟環境的專用故障復原演練與證據 |

以上缺口不計入本輪「PASS」。下一階段應先完成可控時鐘與單一年度scenario runner，再把八類獎金、退款、年底付款收尾接成同一條可核對的事件流。

## 可重跑與原始證據

所有重跑僅指向專用本機測試 PostgreSQL。先執行 `pnpm db:generate`、`pnpm build`，再於 `backend` 目錄設定本機 `DATABASE_URL` 及獨立 `PHASE2_DB_EVIDENCE_PATH`，執行：

```text
node scripts/api-jest-isolated.mjs --json --outputFile=<absolute-result.json>
pnpm exec tsc --project apps/api/tsconfig.e2e.json --noEmit
node scripts/r11-inactivity-test.mjs
node scripts/test-todo-gate.mjs
```

本次輸出在 `C:/UCell/logs/`：

- `annual-release-jest-20261011.json`／`.log`：修正後完整回歸。
- `annual-release-phase2-20261011.json`：162項真實DB斷言。
- `annual-final-validation-jest-20261011.json`：四組年度測試18案。
- `annual-calendar-final-jest-20261011.json`：212工作精確計數的最後補充驗證。
- `annual-economic-final-jest-20261011.json`：三組經濟整合。
- `annual-test-typecheck-verified-20261011.log`、`annual-backend-build-20261011.log`：型別與build。
- `annual-package-tests-20261011.log`、`annual-inactivity-20261011.log`、`annual-todo-gate-20261011.log`。
- `annual-test-discovery-20261011.json`：預設收錄清單。
- `annual-execution-evidence-20261011.json`：最終逐案索引、來源檔雜湊及限制。

容器清理：回歸結束後確認測試資料庫剩餘0個，再核對本次建立的container ID後停止並刪除容器及其匿名volume；證據為 `C:/UCell/logs/annual-cleanup-20261011.json`。
