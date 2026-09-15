UCell 本機規格核對與 golden test 修正

2026-09-15。Repository：C:/UCell/UCell；branch：rc1-recovered。
本報告接續第一階段報告，記錄使用者提供 C:/UCell/Docs 後的新證據。第一階段輸出保留為當時狀態，不覆寫舊 gates。

**來源與定位**

六份原檔的路徑、SHA256、抽取紀錄數與 Word core properties 見 source-manifest.json；Word 四份均未發現 tracked insertions/deletions。讀取使用 bundled Python 的 ZIP/OOXML，保留正文及表格內段落順序；Pxxxx 是抽取段落 index，Lxxxx 是 SQL 原始行號，並非渲染 page number。沒有修改原 DOCX/SQL，也沒有以檔名或 Word 的預設 2013 metadata 代替正式報備/核准證明。

| ID | 原檔 | 用途 |
| --- | --- | --- |
| S01 | R1.0 多資格獨立經營手冊 v1.5 | 多球規則與公式交叉核對 |
| S02 | R1.0 報備一致版手冊 v1.3 | 標示已報備比例、pool 與 EPV 算例 |
| S03 | PostgreSQL Annotated v1.1 | 資料模型與稽核欄位參考 |
| S04 | PostgreSQL Full Definition v1.0 | 基礎 DDL／procedure 參考 |
| S05 | R1.0B 後台 MVP v1.0 | version/Qualification/event/return 行為 |
| S06 | R1.0B Core Logic 檔名 v4.1 | 核心公式、Active、双樹、多球隔離 |

S06 P0004 明列「已報備制度 > 公司正式核准文件 > 本核心規格 > 海報/討論稿」，與使用者指示一致。S05 P0018-P0031 亦要求已完成報備且有效文件優先。未自行重寫 repository 治理制度。

**已釐清並修正**

S02 P0035、P0202-P0235：pool 為 Referral 42%、Binary 36%、Matching 15%、Global 5%、Welfare 2%，K1/K2 為 pool available / 全體 theory。S01 P0035/P0037 與 S05 P0650-P0667 一致。
S02 section 12.2／P0422、20.3／P0567：4,800 減 2,000 的超額部分乘 60%，EPV=1,680；S01 同段、S05 P0647、S06 P0026 交叉一致。

因此第一階段所保留的 backend/scripts/golden-domain-test.mjs 之 amount×70%、EPV(2400)=1680 與 42/36/12/5/5 pool 是明確 Test implementation defect，不是需要新商業規則的問題。
本次移除该 gate 內錯誤重複公式，直接讀取既有 packages/shared/src/r1-0b-golden.ts 的 R10B/k，並以來源文件的明確 pool 各項與 4,800 算例斷言。保留 Leader G5、RPV depth、K-factor bounds，新增基準/低於基準 EPV 為零的边界檢查。
只改測試 gate；production Rule Engine、商業常數、Prisma schema/migrations/seed、API tests 原檔均未更動。不寫入任何正式 monetary result。
Node 24 可直接讀此 TypeScript source，gate 維持不需安裝依賴。Node 會輸出 MODULE_TYPELESS_PACKAGE_JSON 的效能提示，但 exit 0；未為消除提示把共用 package 轉為 ESM。

**仍須停止的制度語意**

1. Replay 範圍：S02 P0480-P0481 及 S05 P0840-P0844 要求 source-event reversal/clawback 與不影響無關獎金；S06 P0005 要求歷史事件版本。六份資料未提供 replayBinary/replayMatching 的 adapter 契約，也未明定退貨重算時 pool base 是否重算、全體 theory 分母調整範圍、原期 K1/K2 是否應擴及其他受獎球、跨期 carry 傳播與停止條件。不能直接把單球 legacy adjustment 改接 replayPeriod。因此 Backend API build blocker 尚未解除。
2. Golden DB fixture：資料包含公式、制度算例與參數/plan seed，未包含現有 DB golden 所指定的五個 Person/Qualification UUID 完整事件資料集，亦缺其 temporal holder/status/plan/Active/carry/settlement facts。沒有自行捏造 fixture。
3. EPV 時間/累計口徑：S02 P0417-P0418 寫「當月合格消費」累計超額；S06 P0026 的「單次消費超過當月…基準」措辭仍不足以決定多筆同月交易與退貨的 allocation/idempotency 邊界。本次只使用各文件一致的單筆 4,800 算例，不改 production recognizeOrder 語意。
4. 正式 Cut-off：S02 P0660-P0662 明列 K0 日/週/雙周 cut-off 尚需財務/系統參數鎖定；S05 尾端也列尚待公司提供的實際 SKU/各 SKU profile。不能由工程自行設定。
5. 文件控制：S06 檔名 v4.1 但 P0002 寫 Core Logic v4.0；S02 P0679 的自審文字說要排除「啟航推薦對等仍用10/10/10」，與同檔正式比例表/P0638 的10/10/10矛盾。保留並回報，未以自審敘述覆寫明確比例表。這些檔案沒有可識別的報備回執/正式批准簽章，production promotion 仍需原有核准證據。

兩份 SQL 是 reference schema，未用來覆寫目前 migration baseline，也沒有在 DEV DB 直接執行。

**驗證與分類**

驗證命令及退出碼見 gate-results.json；每支命令完整輸出存同名 txt。相關 21 支 offline/static/preflight scripts 全部 PASS；shared frozen golden 6 tests PASS；TEST_TODO_GATE_FAIL 仍維持148。
原 148 executable TODO 沒有刪除、skip 或改成假 assertion，其第一階段逐筆分類仍適用。Schema/migrations/seed/API test tree preservation-check PASS。
本次解決分類：Test implementation（錯誤 golden 常數/算例）；未解決分類：Specification ambiguity（replay/EPV aggregation/cut-off/文件控制）與 Test implementation（DB fixture）。Backend build/DB golden/HTTP/security/UAT/backup 等仍沿用第一階段 BLOCKED/FAIL，沒有因 offline golden PASS 宣稱完整 release 通過。

**Checkpoint、commands 與 git diff**

修改前 checkpoint：22af7cb（本機規格核對前）；daa6bc9（來源 inventory 後、golden 修正前）。
讀取：rg --files C:/UCell/Docs；使用 bundled Python 執行 extract_sources.py；Get-Content/rg 篩選正文、table paragraphs、SQL references。
修正後：node scripts/golden-domain-test.mjs；pnpm --filter @ucell/shared test --runInBand；node scripts/golden-r1b-regression.mjs；node scripts/golden-economic-cases.mjs；node scripts/test-todo-gate.mjs；node governance/local-ssot-review/verify.mjs；git status、git diff --check 與 preservation check。
與88bd3d0相比，程式修改只有 backend/scripts/golden-domain-test.mjs；另新增本機規格抽取/雜湊、核對報告與驗證輸出。沒有 merge main、force push、push 或 deployment。

下一步：先確認上列 replay pool/recipient/propagation 契約與完整五球 fixture 的來源；再以核准規則完成 API/DB 修復並重跑 build/OpenAPI/HTTP/security，不自行猜測。
