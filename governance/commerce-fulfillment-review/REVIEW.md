# Commerce continuation audit — Payment Hub delta

本輪繼續完成上游差異審查與可重現的契約驗證，尚未啟動 B1 runtime implementation。使用者要求的唯一 Schema Owner、Core/Member live ownership 與 Payment Hub 移交仍待確認。此文件接續 `../commerce-fulfillment-audit/REPORT.md` 的 A–L，未覆寫前輪固定基線證據。

## A–L 更新

| 項目 | 本輪狀態 |
|---|---|
| A. Branch / HEAD | 本地 audit clone 維持 detached HEAD `2176b049dde32300e5023bcb7088d89890fec519`；本輪讀取的 integration checkpoint 為 `b1acc4d986fb37364905bea11843b24d53e4fbb3`。後者為稽核快照，不保證遠端其後未前進。 |
| B. Existing inventory | 上次 closing checkpoint `98a69992940fb00c89b592aa964614a1c7e4cce5` 之後新增 `payment-evidence-sanitizer.ts` 與 `payment-provider.registry.ts`、對應 tests 及 V1_18/V1_19 reports；另修正 organization test 重複 import。未出現新的 Inventory/Shipment/Invoice runtime。完整 compare 在 upstream-delta.json。 |
| C. Prisma ownership | delta 沒有 schema/migration 修改；仍沒有具名 Owner / merge checkpoint。不能以未改 schema 推論 Owner 已確認。 |
| D. Reusable infrastructure | 沿用已有 PaymentProviderAdapter、canonical transition、event hash classifier；sanitizer/registry 可納入後續架構，但需補下列邊界。既有 outbox/idempotency/audit/RBAC 分析仍見前輪報告。 |
| E. Core / Member conflict | Core 任務仍 active，最近再次寫入 payment-hub；live file locks 未取得。Member 遠端歷史不構成現行 ownership 證明。此輪只寫獨立 audit 目錄，未移交或覆寫共享檔案。 |
| F. Missing schema | 前輪 Schema proposal 仍有效為提案；new helpers 不提供 PaymentEvidence/Event、payment transaction、reservation、serial claim、QC、shipment、invoice、ERP 持久化模型。 |
| G. Missing APIs | 新 helper 沒有增加公開 controller/route；44-operation OpenAPI proposal 尚未掛載。verified ingress、reconciliation 與 persistence wiring 尚待實作。 |
| H. Missing tests | 本輪補 22 項 isolated helper probes：14 PASS / 8 FAIL。不是 TypeScript typecheck、Nest integration、HTTP、DB race 或 Golden。 |
| I. Provider prerequisites | 台新官方 merchant API/version、簽章與 query/reconciliation 驗證契約、sandbox/config references 仍待取得。本輪無外部 provider 呼叫。 |
| J. Proposed branch | 保持 `feature/commerce-fulfillment-b1-contracts`，尚未建立；需先確認共同 checkpoint 與 writer 範圍。 |
| K. Exact file plan | 前輪 OWNERSHIP_PLAN 的 12 個 runtime 檔案仍為 proposed only。本輪新增的 review artifacts 列於下方。sanitizer/registry 修正列為待核准增補，不暗中擴張已提議的 B1 檔案集。 |
| L. Safe to begin B1 | **B1 BLOCKED**：唯一 Schema Owner、Core/Member live scope、Payment Hub shared-file writer 與 evidence/Core bridge 尚未凍結。 |

## 實測結果與修正方向

source snapshots 來自指定 GitHub commit；runner 驗證每份 content 的 Git blob SHA，並記錄 SHA-256。僅在記憶體中移除兩個已核對的 type import，再用 Node TypeScript transform 執行原始 helper；沒有改上游邏輯。runner 在 assertion 不滿足時正常輸出 FAIL 並 exit 1，不把紅燈當作 PASS。

| Case | Result | 實際觀察 | 下一步與責任 |
|---|---|---|---|
| P01–P03 | PASS | browser PAID 被擋；signature=false webhook 被擋；完整 asserted webhook evidence 可通過。 | 真正 signature verification、event identity 與金額/order/provider binding 仍須 ingress integration 證據；boolean 並非密碼學驗證。 |
| P04 | FAIL — boundary proposal | POS 只有 transaction/operator/terminal refs 就可 PENDING → PAID。 | 凍結 controlled POS 的已驗證 query/reconciliation authority；refs-only 記錄先作 evidence，不能直接作 PAID authority。 |
| P05 | FAIL — boundary proposal | query 只帶 transaction ref 即被 helper 接受。 | adapter/application 必須在可信邊界產生 verified receipt；若設計由 caller 保證，需實作並以 HTTP/DB 測試證明，不能只依 source 字串。 |
| P06 | FAIL — runtime input hardening | 未知 source 配合 POS refs 落入最後的 POS 分支並通過。 | 將 evidence source 明確 switch，default 拒絕；入口 runtime validation 也需拒絕不在 enum 的值。 |
| P07–P08 | PASS | 同 hash 為 REPLAY，不同 hash 為 CONFLICT。 | 只是 pure classifier；唯一鍵、交易與 webhook/query race 仍未驗證。 |
| S01–S03、S08 | PASS | 已知 secret key redaction、PAN key 拒絕、nested Date 拒絕、safe shape 與 input immutability 成立。 | 後續證明所有 persistence/log/error 路徑實際使用 safety boundary。 |
| S04–S05 | FAIL — serialization | NaN、Infinity 被接受，JSON serialization 將其轉成 null。 | numeric branch 增加 Number.isFinite；保留 safe amounts 的 decimal-string contract。 |
| S06 | FAIL — boundary proposal | synthetic、通過 Luhn 的 numeric 值未受 string PAN 檢查。 | 優先 provider-specific allowlist + safe typed projection，避免 arbitrary metadata；numeric/freeform 卡資料拒絕策略需涵蓋。不得依 PAN heuristic 取代安全欄位設計。 |
| S07 | FAIL — boundary proposal | 未列入 denylist 的 providerSecret 欄位原樣通過。 | 僅接受核准 safe DTO 欄位，禁止 raw response/body 與未知 secret 欄位进入可持久化 evidence。單純擴充 denylist 不是完整防線。 |
| R01–R04、R06 | PASS | missing/disabled/pending/unavailable/duplicate 的既有 guard 正常；ENABLED 可 resolve。 | 不代表 provider 已啟用或完成 UAT。 |
| R05 | FAIL — runtime input hardening | JSON availability=ENABELD 搭配 adapter 可 resolve。 | 正向要求 status === ENABLED 才放行，其餘一律拒絕；config loader 必須 enum validation。若目前只有 typed constants，這是未來外部 config 邊界測試，不宣稱已有遠端可利用路徑。 |

P04/P05/S06/S07 是本次需求導出的安全邊界提案；其 FAIL 表示 helper 單獨不足以建立此保證，不等同既有函式已承諾提供整個 ingress 安全功能。P06/R05 是從 runtime 非型別化輸入驗證 fail-closed，TypeScript 編譯型別不能取代 JSON 驗證。沒有證據顯示真實信用卡或 secret 已被儲存；測試只用 synthetic fixtures，結果不輸出測試敏感值。

## 可交接的修正範圍（尚未套用）

| File | Proposed change | Writer gate |
|---|---|---|
| `backend/apps/api/src/modules/payment-hub/payment-provider.adapter.ts` | 定義 verified receipt 的 binding、safe evidence reference 與 verification provenance；provider query / webhook / reconciliation 收斂至同一可信事件入口。 | 原 12-file B1 範圍內，但待 Payment/Core contract freeze。 |
| `backend/apps/api/src/modules/payment-hub/canonical-payment-transition.ts` | 未知 source fail closed；POS/query 只接受已驗證 receipt。相同 status no-op 不得取代入口驗證或 event dedup。 | 原 B1 範圍內，待 writer 移交。 |
| `backend/apps/api/test/payment-hub-contract.e2e-spec.ts` | 加入 P04–P06 negatives；完整驗證另由 ingress/DB tests 覆蓋。 | 原 B1 範圍內。 |
| `backend/apps/api/src/modules/payment-hub/payment-evidence-sanitizer.ts` | finite number guard、allowlisted safe DTO projection、unknown payload policy。 | 新增 shared file，待 owner 確認，不能自行吸收為 Commerce 所有。 |
| `backend/apps/api/test/payment-evidence-security.e2e-spec.ts` | S04–S07 negatives + safe fields compatibility。 | 同上。 |
| `backend/apps/api/src/modules/payment-hub/payment-provider.registry.ts` | affirmative ENABLED guard、unknown config rejection。 | 新增 shared file，待 owner 確認。 |
| `backend/apps/api/test/payment-provider-registry.e2e-spec.ts` | R05 invalid runtime config negative。 | 同上。 |

Receipt 不能只新增 `verified: true` 讓任意 caller 自行聲稱；實際 adapter verification、支付與訂單/金額/幣別綁定、唯一 provider event identity、safe evidence persistence、原子 state transition 與 Core recognition bridge 需共同設計。這些是待凍結的 contract，不是本輪偷改 monetary recognition 的授權。

## Reproduce / changed files / evidence

從 audit clone 執行：

```powershell
node governance/commerce-fulfillment-review/probe-upstream.mjs
```

目前預期結果為 22 probes、14 PASS、8 FAIL、exit code 1。保留紅燈直到負責 owner 修正並提供新的固定 source snapshot；不要覆蓋此 checkpoint 的結果。

本輪新增檔案：

- `governance/commerce-fulfillment-review/REVIEW.md`
- `governance/commerce-fulfillment-review/upstream-snapshot.json`
- `governance/commerce-fulfillment-review/upstream-delta.json`
- `governance/commerce-fulfillment-review/probe-upstream.mjs`
- `governance/commerce-fulfillment-review/probe-results.json`
- `governance/commerce-fulfillment-review/manifest.json`

| DoD | 本輪證據 |
|---|---|
| Snapshot integrity | PASS：4 個 Git blob，SHA-256 見 probe-results.json |
| Isolated helper probes | 14 PASS / 8 FAIL；詳細分類如上 |
| Build / TypeScript typecheck | NOT RUN |
| Migration from zero / DB assertions / concurrency | NOT RUN；schema/migrations 無改動 |
| HTTP / BOLA / RBAC / 20 Golden | NOT RUN；前輪 TEST_PLAN 繼續有效 |
| OpenAPI | 沿用前輪 proposal；本輪無 mounted API 變更 |
| Provider Mock / Sandbox-UAT / Production | NOT RUN / NOT VERIFIED / NOT READY |
| Runtime tracked diff | 應為空；見 manifest.json closing check |
| New commit | 無；未提交或推送，未變更 checkout HEAD |

**B1 BLOCKED**。開工需具名唯一 Schema/migration Owner、Core/Member branch/file inventory 與 Payment Hub writer 移交，以及 payment evidence → Core contract / Return POSTED bridge 的責任邊界。仍可持續審查與完善提案；禁止自行產生 migration 或猜測 monetary rule。
