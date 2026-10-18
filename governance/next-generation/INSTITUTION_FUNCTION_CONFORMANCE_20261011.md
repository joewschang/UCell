# 制度、流程與功能測試續測紀錄

日期：2026-10-11（Asia/Taipei）。狀態：**PARTIAL_VALIDATED，尚未達成每一條制度、每一功能完整驗收**。

本輪延續年度模擬，新增逐代 RPV、失格月份邊界、升級工作流及全後台匿名存取測試，並修正真實重現的升級缺陷。測試通過數不代表制度覆蓋率；沒有完成逐條分解與來源效力確認前，不提供百分比。

## 執行結果

API 最新執行證據合計 **228 組／1,638 案 PASS，0 個未解決失敗或跳過**。此數字由完整回歸及精確重測合併，並非宣稱第一次全套即通過：初次 227 組／1,637 案中 1,635 PASS、2 FAIL；補齊兩個舊 fixture 後，受影響兩組與新增升級組共 47 案重跑 PASS；另外 runtime 路由組 1 案 PASS。合併時以檔案、案例名稱及同名出現序號辨識，重跑不重複累加；原始 FAIL JSON 保留。

| 範圍 | 結果與證據邊界 |
|---|---|
| Admin 前端 | 245 案 PASS；元件／互動測試，不是所有正式帳號的人工 UAT |
| Member 前端 | 271 案 PASS；元件／互動測試 |
| Shared 模組 | 5 組／181 案 PASS |
| 真實 PostgreSQL 基礎驗證 | 162 項斷言 PASS；各 runner 重複初始化不重複加總 |
| 會員瀏覽器 | Edge headless 的 `mobile-smoke.cjs` PASS；320／390／768 寬度、球切換、訂單／購物車／通知、資料隔離、無溢出及 JS 錯誤；本地 mock 模式，不是正式下單付款 |
| 全後台匿名入口 | 完整 App 實際註冊的 377 個 HTTP 方法全部回傳 401；包含框架自動 HEAD，不等於 377 個獨立業務功能；管理員 bypass 關閉 |
| 後台身分與角色 | 完整 App 既有 HTTP 安全門檻 PASS；合成 Entra 身分，驗證無登入拒絕、Membership 不可操作付款、Finance 不可操作 workflow、Compliance 可查稽核；不是外部 Entra 實際登入驗收，也不是所有端點角色矩陣 |
| 編譯／建置 | 後端 packages/API/Worker build、API 測試型別檢查、Admin 與 Member build 均 PASS；Admin 有非阻擋的大 bundle 提示 |
| 待辦 gate | `TEST_TODO_GATE_PASS`；不能據此推論未實作的制度不存在 |

## 新增可獨立追查的案例

| 檔案 | 案例數 | 實際驗證 |
|---|---:|---|
| `institution-rpv-generation-matrix-db.e2e-spec.ts` | 42 | 0／1／2 有效直推 × G1～G13，共 39 個逐代結果；固定每代 100、解鎖 5／8／12、G13 不建立；未來才生效的直推不可借給歷史月份；3 個重送去重案例。使用真實 RpvService 與 DB |
| `institution-inactivity-rules.e2e-spec.ts` | 22 | 首個完整台北曆月、月初精確時刻與 +1ms、閏年／跨年、規則與球啟用時間取較晚者；同人不同球隔離、連續月份、重置、缺少或重複證據、修訂月份重算及 11／12 月提醒分類。提醒分類不是實際發送 |
| `institution-upgrade-db.e2e-spec.ts` | 14 | 三方案全部 9 種方向、舊申請不得覆蓋較高方案、無效方案、600 審核費旗標、禁止倒填、生效歷史銜接與重複核准拒絕。使用真實 WorkflowService 與 DB |
| `institution-admin-route-auth-db.e2e-spec.ts` | 1 | runtime 註冊路由逐一匿名請求，377 個方法的 status 各自存入證據；僅存取控制，不是授權後功能驗算 |

另將既有 `full-app-security.integration.ts` 納入預設 Jest discovery，並補上與正式入口一致的 RequestContextInterceptor，斷言 HTTP 成功稽核確實保存有效 correlationId 與 requestId。

本輪沒有改寫上輪四組 15 個月年度案例。年度執行與限制仍見 [年度模擬執行紀錄](ANNUAL_INSTITUTION_TEST_EXECUTION_20261011.md)。

## 已重現並修正的問題

**升級流程允許同級、降級及無效方案；舊申請可將已升高的方案降回去。** 修正前獨立 DB 回歸為 9 FAIL／5 PASS，原始 FAIL 證據保留。現在提交時驗證 STARTER → ELITE → LEADER 的嚴格向上關係，核准時在資格鎖內再次驗證當前方案；拒絕的核准會回滾，不關閉或新增方案歷史。

尚不能把這項修正視為完整升級驗收：規格要求的方案差額付款及 600 元收款證據對帳，現有 workflow 的 `reviewFeePaid` 旗標無法單獨證明；排程未來生效時的 current snapshot、所有角色權限和同時核准競爭也需要專門驗證。

新增 RPV fixture 曾因未來直推缺少先前 DRAFT 歷史而被 replay seal 拒絕；已補齊歷史 fixture，未放寬正式證據要求。這是測試資料缺陷，與升級產品缺陷分開記錄。

完整回歸另有兩個舊升級 fixture 缺少 `currentPlan.planCode`；補上原本情境所需的 STARTER 後，兩組舊測試及新增升級組合計 47 案重跑通過。正式 guard 保留，原始失敗結果不覆寫。

瀏覽器 smoke 期間 Vite 曾記錄對未啟動的本地 API（3001）的 ECONNREFUSED；畫面使用 mock／fallback，沒有因此取得真實後端流程驗收證據。表中的無 JS 錯誤指 smoke 捕捉的頁面執行例外，不表示所有 HTTP 請求都成功。

## 規格與功能追溯

可重跑盤點工具：`backend/scripts/institution-conformance-inventory.mjs`。輸出包括：

- 四份 DOCX 共 2,842 個段落的 SHA-256、逐段原文索引；段落不是規定數，也未獨立證明是已報備版本。
- 20 項 Decision Register 與 31 項 2026-10-03 制度修訂條款；保留來源階層，不用新檔名推定取代已報備文件。
- 83 個 API Controller 檔案、350 個靜態方法宣告的清單、行號與 hash；靜態宣告不等於實際啟用或功能已通過，與包含自動 HEAD 的 runtime 方法採不同計數。
- 實際 Jest／Vitest 每案名稱與結果；已人工比對的部分條款附明確證據與驗證邊界。
- 完整 App 377 個匿名請求結果。其餘功能驗收維持 UNMAPPED，不能自動因同名測試存在而標為 PASS。

完整 SSOT 來源組、條款分解、例外、跨條款組合與正式參數的分母仍未完成。`coveragePercent` 明確為 null。

## 尚未通過完整驗收的必要項目

| 優先順序 | 項目 | 本輪能確定的缺口與下一個可驗收成果 |
|---|---|---|
| P0 | LIFE-05／06／07／08 失格與承接流程 | 現有 evaluator 與新日期 helper 不能代替月結排程、RECLAIM_REVIEW、通知內容／送達／讀取／重試去重、異議期限、人工確認與公司承接。須建立同一球的完整流程；退貨更正應進審查，不可自動刪球或倒改 Holder |
| P0 | 升級與各費目 | 差額 28,800／57,600、對應套組及獨立 600 元費目，要由實際付款證據進核准鏈；現有 flag 測試不足。入會／升級／轉讓費與退款各自需要案例 |
| P0 | 生效政策 | GATE-01～07 仍需契約／公告、effectiveFrom、RuleVersion、保留與退款政策、回收異議／權限及 RPV A 型適用證據。規格核准不等於已正式啟用；本輪未填造政策或啟用回收 |
| P0 | 同一組織全年完整帳鏈 | 上輪 Active／EPV／RPV／Calendar 是分開情境；仍需註冊→核准→安置→交易→Active→八獎金→各結算→可付→付款結果→退款追回在同一事件鏈、每期獨立 oracle 與總帳守恆。212 個排程工作建立不等於全部執行成功 |
| P1 | 全功能授權後操作 | 每個 API／頁面需正常、邊界、錯誤、角色、跨會員／跨球隔離、重送、併發及 UI→API→DB 可追查案例；377 個匿名拒絕不代替這些驗收 |
| P1 | 真實外部流程 | Google／LINE／手機 OTP、實際通知、物流、銀行檔接收與結果回填，須取得測試環境回應及 UAT 證據；本輪只有本地合成或 mock，不曾實際匯款／發信 |
| P1 | 年度效能與復原 | 尚未驗證目標規模年度負載、備份還原、主機斷電持久性及故障期間的完整年度補跑 |

## 隔離、重跑與證據

工作區：`C:/UCell/worktrees/party-spouse-control`，包含既有未提交變更；本報告不是部署驗收。僅使用本輪 loopback PostgreSQL 容器與隨機 `ucell_jest_*` DB、合成身分及交易。fsync=off 用於縮短 fixture 建置，因此不宣稱斷電持久性。未写入 Stage／Production、未改系統時鐘、未真實匯款或通知。

證據目錄：`C:/UCell/logs/`。

- `institution-release-jest-20261011.json`／`.log`：完整 API 回歸。
- `institution-retest-jest-20261011.json`：兩組舊 fixture 修正及升級回歸，47 案 PASS。
- `institution-route-jest-20261011.json`、`institution-admin-route-status-20261011.json`：補充 runtime 路由測試與各方法狀態。
- `institution-admin-20261011.json`、`institution-member-20261011.json`、`institution-shared-20261011.log`：前端與共用模組。
- `institution-release-phase2-20261011.json`：162 項 DB 基礎證據。
- `institution-upgrade-red-20261011.json`：修正前 9 個失敗案例，保留不覆寫。
- `institution-member-browser-20261011.log`：會員瀏覽器 smoke。
- `institution-conformance-inventory-20261011.json`：来源、條款、路由、逐案結果及來源 hash。

重跑完整 API：啟動隔離本地 DB，設定 `DATABASE_URL` 與獨立 `PHASE2_DB_EVIDENCE_PATH`，執行 `node scripts/api-jest-isolated.mjs --json --outputFile=<結果路徑>`。現在預設 discovery 也包含新增路由 suite；上列初次完整回歸開始後才加入該 suite，因此本輪的路由證據獨立存檔，不重複計入第一次完整結果。

本輪結束時確認隔離容器中 `ucell_jest_*` 資料庫為 0，已停止並移除本輪容器及匿名資料卷，也停止本輪 Vite。清理證據為 `institution-cleanup-20261011.json`。
