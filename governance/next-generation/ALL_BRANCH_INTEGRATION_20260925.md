# 全分支整合紀錄（2026-09-25）

目標：`integration/member-backend-mvp`。整合作業先在 `codex/integrate-all-branches-20260925` 獨立 worktree 完成，再以 fast-forward 回到目前工作分支。

## 分支盤點與處理

已從 GitHub `joewschang/UCell` 擷取完整 heads（原 clone 僅自動追蹤單一 integration 分支），逐一檢查 ancestry。

| 分支 | 盤點時 SHA | 處理 |
|---|---|---|
| codex/backend-phase2 | c859f1e | 原已包含 |
| codex/backend-phase3 | 73bb928 | 原已包含 |
| codex/experience-v2-shell-phase2 | 3a37096 | 合併 UX、導覽、焦點與相關測試 |
| codex/swaggerhub-ci-governance | 1da7e84 | 合併 OpenAPI、SwaggerHub、CODEOWNERS 與 CI／發布檢核 |
| feature/member-liff-mvp | f12b164 | 原已包含 |
| integration/member-backend-mvp | 7df3cda | 本次基底，另保留未提交的 Ball V2／待安置工作 |
| main | 954a1b0 | 原已包含 |
| rc1-production | c691088 | 隨 reconstruction 分支納入歷史 |
| rc1-recovered | df13581 | 原已包含 |
| rebuild/rc1-source-v1 | 3d0cfcb | 以保留現行實作的 merge 納入歷史，理由如下 |

早期 `rebuild/rc1-source-v1` 僅有 Person／Qualification 最小 schema、單一 Nest bootstrap、初始 workspace 及未完成的 RC1 壓縮分片。現行多模組系統已取代這些框架。此次保留該分支與其 `rc1-production` 祖先的 Git 歷史，沒有重新啟用第二份資料模型、舊啟動入口或不完整來源包。

亦檢查本機其他 UCell clones/worktrees：`C:\UCell\UCell`、`swaggerhub-ci`、`experience-v2-shell-phase2`、`ux-v2-phase1`、`ux-v2-analytics-phase1`。額外的本機 checkpoints `9c6fbee`、`63b9a21`、`d6acc06`、`903b8e9` 均已包含於目前歷史。其他 clone 的未提交草稿不屬於分支提交，保留原處，未搬移或覆寫。

## 衝突處理與完整性

- 保留目前 Admin 八組分類及後續新增的樹／Reservoir 路由；納入群組存取權限測試。
- 保留現行 Member 球號、會員編號、獎金明細、零售購物與帳戶流程；納入切換資格時持續顯示導覽、收益子導覽、跳至主要內容與焦點恢復。
- Phase 2 資料庫測試保留既有交易內測試資料與回滾方式；CI 採用具隔離資料庫的 API runner。
- package scripts 同時保留 analytics／scale／RC 與 SwaggerHub scripts。
- 目前工作目錄原有變更先以 `aee11dd` 保存，再納入整合，未丟棄；`backend/.tmp-rc-v2.exit` 留在原處，不作為產品原始碼提交。
- 修正待安置參照碼前端正則的雙重跳脫，讓無 BallNo 的資格可用 `P<qualificationNo>` 提交；伺服器仍驗證 Sponsor 所有權與安置權限。參照碼與 BallNo 分開使用，不將內部 UUID 當球號。
- 父球格式支援現有多字元樹代碼；伺服器拒絕超出 bigint 的參照碼；提交成功後回傳實際分配的 BallNo。
- 同步產生 OpenAPI：會員安置路由改為 `/api/v1/member/placements/pending/{placementReference}/place`。此變更需讓客戶端與 API 同步部署。

## 驗證

- Backend 全 workspace build：PASS。
- 隔離 PostgreSQL：84 migrations 全部套用；154 基礎資料庫斷言 PASS。
- Backend 完整 API suite：103 suites、845 tests PASS；隔離資料庫已清除。
- Member：31 suites、175 tests PASS；typecheck／production build PASS。
- Admin：115 tests 分批通過（原 111 項與修正後的 4 項 AppShell tests）；production build PASS。
- 真實 Edge headless browser：切換中焦點、成功後焦點還原、主動移至導覽後不搶回焦點、拒絕與重試流程 PASS。
- Prisma／source／schema／migration／security／OpenAPI 靜態檢查 PASS。
- SwaggerHub publisher unit tests：24 PASS、0 skipped（包含官方 checksum 驗證的 oasdiff 1.32.1 實際比較測試）。

## API 契約審核結果與發布限制

已修正兩個分析 API 的 `Idempotency-Key` 大小寫重複宣告，保留明確的長度與格式限制，避免同一 header 出現互相矛盾的 Swagger schema。

完整結果見 [ALL_BRANCH_OPENAPI_REVIEW_20260925.json](ALL_BRANCH_OPENAPI_REVIEW_20260925.json)。目前規格為 1.1.0、182 paths、196 operations、88 schemas；oasdiff validation、secret scan 與 security compatibility 均 PASS。

相對 SwaggerHub 原核准 baseline，breaking diff 列出 8 項差異：

1. Admin 資格查詢的 qualificationId 明確限制 UUID。
2. 訂閱查詢 status 限制允許值。
3. 訂閱查詢 take 最大值 200。
4. 訂閱查詢 take 最小值 1。
5. 訂閱查詢 qualificationId 明確限制 UUID。
6. Member me 的 memberNo 由 UUID 改為業務會員編號。
7. Member profile 的 memberNo 同上。
8. 舊 `/member/qualifications/{id}/place` 路由已由公共待安置參照碼流程取代。

這些差異已具體列出供契約審核；不放寬現行輸入驗證、不恢復錯誤會員編號語意，也不修改核准 baseline 或跳過 breaking-change gate。因此 SwaggerHub 自動發布仍會受契約差異門檻阻擋，並非發布驗證全綠。程式分支整合與本機建置完成不代表已部署正式服務。

本次未部署遠端服務、未發布 SwaggerHub 契約、未新增資料庫 migration。既有 SwaggerHub 核准 baseline 與 breaking-change 禁止規則保留，不以更新 baseline 掩蓋差異。
