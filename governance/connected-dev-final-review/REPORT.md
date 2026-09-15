# Connected DEV 第一階段最終工程核對

2026-09-15；Repository C:/UCell/UCell；branch rc1-recovered。Production Promotion BLOCKED；沒有升 RC2、merge main、force push、push 或 deployment。

本輪修改前 checkpoint：9b89e2c。完整逐命令 PASS/FAIL Matrix 見 [PASS-FAIL-MATRIX.md](final/PASS-FAIL-MATRIX.md)，退出碼與開始時間見 [gate-results.json](final/gate-results.json)，原始輸出存 final/ 同名 txt。此處為新一輪結果，不覆寫前兩階段證據。

## 本輪修改與既有工程修復

新增 backend/scripts/run-bash-gate.mjs，讓 Windows pnpm gate scripts 明確使用 Git for Windows Bash，避免 PATH 指到 WSL Bash 導致 Windows Node/pnpm 執行環境不一致。非 Windows 保留 bash。只接受四個既有 gate filename；找不到 Bash、錯誤輸入或子程序失敗均保留非零退出碼。backend/package.json 的 preflight、dev:smoke、rc:gate、release:prep 改為此入口，原 Bash gate 內容與商業規則未改。

新增本輪 runner、證據、分類、matrix 及 Legacy Test Drift 原檔。上一階段完整修復與檔案清單見 ../connected-dev-phase1/REPORT.md；主要已包含正式 pnpm lockfiles、Node24/pnpm12 build-script policy、Prisma6/TS5/Nest11 相容版本、直接依賴、Windows URL 路徑、Jest/ts-node、Vite types、已知 Prisma 欄位及 temporal plan lookup 缺陷與 dependency security 更新。

## PASS/FAIL 摘要

| Gate | 結果 | 限制／原因 |
| --- | --- | --- |
| Node / pnpm | PASS | v24.21.0 / 12.4.1 |
| Backend / Admin frozen install | PASS | 正式 lockfiles 可重現安裝 |
| Backend peers | PASS | 無 peer violation |
| 21 offline/static/preflight scripts | PASS | 含 security policy；source/static PASS 不代表 runtime 已驗證 |
| Admin preflight / selfaudit | PASS | static gates |
| PostgreSQL16 | PASS | container Running；實際16.15 |
| Prisma validate / generate / migrate deploy | PASS | 16 migrations，無 pending；未改 schema/migrations |
| Backend Build | FAIL | API 缺 replayBinary/replayMatching；兩處錯誤重複報告為4 diagnostics |
| Worker / contracts / shared / database Build | PASS | recursive build 日誌有各 package 結果 |
| Admin Build | PASS | 有 bundle size warning，非 build failure |
| Shared Golden | PASS | 6 實際測試 |
| API Jest E2E runner | PASS（有限） | 3 實際工程測試；148 TODO 未執行，不能宣稱 domain E2E 完成 |
| Admin tests | PASS | 4 實際權限測試 |
| Backend root tests / TODO Gate | FAIL | 148 executable TODO |
| DB Golden | FAIL | 缺指定五球 fixture；不是 ts-node 或 DB 連線失敗 |
| OpenAPI export / preflight | FAIL | export 被相同 API compile defect 阻塞；無完整新 spec |
| Security HTTP / HTTP smoke | FAIL | API 未啟動，connection refused；未使用 stale dist 冒充 runtime |
| Backend / Admin dependency audit | PASS | 0 advisories（本次 registry audit 結果） |
| UAT Gate | FAIL | 21 P0 NOT_RUN；另外9 P1亦無驗收證據 |
| CI / RC / Release / pnpm gate entrypoints | FAIL | 正確保留 API Build 或148 TODO blocker，入口已能執行 |
| Frozen schema/rules/original TODO preservation | PASS | 與 df13581 比對無修改 |
| Live Entra / backup-restore / integrity / actual GitHub Actions | NOT_RUN | 不以 static PASS 替代正式驗證 |

## 失敗分類與停止範圍

| 分類 | 狀態 |
| --- | --- |
| Toolchain compatibility | Node24/pnpm12、Prisma/TS/Nest/Jest、Windows paths、Bash 入口已修復 |
| Dependency | frozen install、peer check、直接依賴、已知 security advisories 已修復 |
| TypeScript | 已知純工程錯誤已修復；replay 兩處 TS2339 仍存在 |
| Prisma/DB | schema/client/migrations PASS；DB fixture 缺失另列 Test implementation |
| Application implementation | RPV source ID、polymorphic payable query、audit JSON null、EPV temporal plan lookup 已修復；replay integration 未解決 |
| Test implementation | runner 與13實際測試可執行；148 TODO、DB fixture、conditional parameter assertions 的 vacuous-pass 風險仍未解決 |
| Legacy Test Drift | 原 golden-domain EPV70% 與42/36/12/5/5 pool 和現行來源不一致；原檔與 hash 保留，見 legacy-test-drift.json |
| Specification ambiguity | replay pool/recipient/跨期 carry 契約、EPV 同月多筆及退貨 allocation、正式 cut-off、文件控制仍待核准來源 |

缺失 replay 方法不能以 any、ts-ignore、stub、停用 production module 或把單球 adapter 任意接全期 replayPeriod 來掩蓋。這會決定 K1/K2 分母、受影響球與 carry propagation，已超出純工程修正。六份 C:/UCell/Docs 的核對、hash 與段落證據見 ../local-ssot-review/REPORT.md 及 source-manifest.json。

Legacy Test Drift：前一 commit d3e0764 已修正測試 gate 去讀現有 shared 常數，未修改 production 規則。本輪依最新指示正式登錄 drift 並保存 df13581 原檔；沒有再改 EPV/pool 語意。原始來源見 golden-domain-test.legacy.mjs.txt，歷史修正與 hash 見 legacy-test-drift.json。不能因修正後 golden PASS 宣稱完整 monetary correctness。

DB fixture JSON 只有五球及雙樹拓撲摘要，缺完整 temporal/Active/事件與核准預期；缺失 golden-r1-0b.ts 沒有被自行捏造。DB golden 裡 optional parameter checks 仍可能在缺參數時無斷言；此風險保留，不放寬測試，也不把缺 fixture 視為 PASS。

## 148 TODO 分類

全部屬 Test implementation／未實作 domain E2E，逐筆 file、line、title、domain 見 final/todo-inventory.csv 與 json。每一項需要核准規格核對；測試標題不足以證明 production 實作錯誤。

| Domain / 原檔 | TODO |
| --- | ---: |
| bonus-engine-v04 | 26 |
| epv-global-v05 | 12 |
| idempotency | 4 |
| negative-flow-v05 | 12 |
| organization | 5 |
| qualification-isolation | 4 |
| v060-adjustment-lifecycle | 10 |
| v061-replay | 18 |
| v062-carry-chain | 13 |
| v063-golden-path | 8 |
| v064-golden-dataset | 11 |
| vertical-slice-02 | 16 |
| vertical-slice | 9 |
| 合計 | 148 |

没有刪除 TODO、skip 或假 assertion；API Jest exit0 只代表現有 runner 可運作，root/TODO/RC gates 仍 exit1。

## Commands、diff 與下一階段

完整 gate commands 在 matrix（含 Node/pnpm/git、frozen installs、21 scripts、Prisma、builds、tests、DB Golden、OpenAPI、security HTTP、audits、UAT、CI/RC/release）。另外執行 git status、checkpoint commit、git diff --check、docker compose --env-file .env.example up -d postgres、docker exec backend-postgres-1 postgres --version；版本16.15。launcher unsupported filename 實測非零退出碼，pnpm rc:gate 實測進入原 TODO guard。原始 command logs 不修剪 stderr 或失敗資訊。

source-diff-stat.txt 是 df13581 至本輪的工程檔案 diff 摘要；current-stage-diff.txt 是 d3e0764 至本輪的 backend diff。兩套 lockfiles保留；RELEASE_MANIFEST/SHA256SUMS 歷史 artifact 未為本次修改自動升版。所有本輪程式修正後重跑相關入口與要求的完整矩陣。

下一階段先取得正式 replayBinary/replayMatching 或 approved adapter 契約，以及五球完整 fixture/預期事件資料；依核准規格補實作、重跑 API Build，再執行真實 DB/OpenAPI/HTTP/security。逐領域實作148 TODO，最後完成 UAT、live security、backup/restore/integrity 與 release evidence。Production 繼續 BLOCKED，RC2 須另有明確升版授權。
