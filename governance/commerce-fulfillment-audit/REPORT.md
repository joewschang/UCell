# Commerce & Fulfillment 首次稽核

日期：2026-09-17（Asia/Taipei）。結論：**B1 BLOCKED**。

本次為 audit / proposal，不是 Commerce 實作完成報告。所有發現固定在 `2176b049dde32300e5023bcb7088d89890fec519`；線上支線可能繼續前進。未修改既有程式、Prisma、migration、monetary rule，未部署、提交或推送。提案不代表已凍結 API 或已指定 Owner。

**結束前更新：integration 已前進至 `98a69992940fb00c89b592aa964614a1c7e4cce5`，新增 Payment Hub contract，形成實際 B1 scope 重疊。已完整補讀新增兩個 commit / REPORT，見 `CLOSING_DELTA.md`；B1 必須接用已有 payment-hub，不建立平行 canonical。**

## A. Current branch / HEAD

| 位置 | Branch | HEAD |
|---|---|---|
| 原共用 UCell Dev | unborn `master`；未設定 remote | 無 commit |
| 本輪獨立 `commerce-audit-source` checkout | detached HEAD，供固定版本稽核 | `2176b049dde32300e5023bcb7088d89890fec519` |
| 遠端指定基線 | `integration/member-backend-mvp` | 同上（開始稽核時） |

基線最新 commit：`feat(commerce): expose package order operations status`。尚未建立 Commerce feature branch；避免把「稽核 checkout」誤報成已核准開發支線。

## B. Existing code inventory

以下路徑均相對 repository root；實際 code 是現況證據，舊 REPORT 的 PASS 不等於本輪重跑。

| Domain | 既有位置 | 現況 / 差距 |
|---|---|---|
| Order | `backend/apps/api/src/modules/order/order.service.ts`、`order.controller.ts`、`dto/` | server pricing、Qualification scope、confirmed order、manual payment；無營運庫存、shipment、invoice state machine |
| Product | `backend/apps/api/src/modules/product/` | `ProductReference` + effective-dated `ProductRuleProfile`；不是規格字面上的 ProductProfile/ProductVersion，不另造第二套商品身分 |
| Payment | `OrderService.confirmPayment`（198 行起）、Prisma `PaymentEvent`（854 行起） | amount exact check、人工 reference、idempotency、audit/outbox。無 provider identity/signature/query/refund/reconciliation；不可視為台新 Adapter |
| Package | `modules/package-config/`、`OrderService.createPackageMember` | 已有六種 DRAFT seed、version/product pool、snapshot/selection、immutable triggers；不得重建或硬編碼 |
| Package recognition | `order.service.ts:252` 之後、v15 migration | package payment 發 `PACKAGE_PAYMENT_CONFIRMED`，禁止 `SALE_CONFIRMED`；Active-duration 維持 configuration pending。recognitionConfigRef 目前為 reference 字串，不是已完成的 recognition resolver |
| Return | `modules/return/return.service.ts`、`return.controller.ts`、`reversal.service.ts` | 直接建立 `ReturnCase.POSTED`，已有 quantity/value cap、`RETURN_CONFIRMED` outbox / Core replay。尚無 REQUESTED/APPROVED/RECEIVED、serial receipt、provider refund、invoice adjustment |
| Replay / Recovery | `modules/adjustment/`、`modules/payout/`、`packages/database/src/historical-replay.ts` | Core protected。Commerce 僅提交 / 消費 evidence，不移植計算 |
| Inventory / Lot / Serial / Pick / QC | 搜尋 `backend/apps`、`backend/packages`、`backend/scripts` 及全 Prisma model 清單 | 未找到營運 model/service/adapter；不得把 Serializable 或 Binary slot race 測試當成庫存實作 |
| Shipment / Invoice / ERP | 同上 | 未找到 domain 實作；Member `shipmentStatus='FULFILLMENT_PENDING'` 是占位讀值 |
| Member / Admin UI | `member/src/{ConnectedShop,QualificationPackageShop,ActiveDurationPackages,commerce}.tsx`、`admin/src/features/{orders,products,returns,packages}/` | 已有 checkout/payment refresh、package picker、後台人工操作；無 warehouse scan/QC/logistics/invoice UI |

## C. Prisma / migration ownership

- 唯一 Prisma schema：`backend/packages/database/prisma/schema.prisma`，PostgreSQL multi-schema：identity / membership / organization / commerce / ledger / audit / integration / rules / subscription。
- migrations：**39** 個 SQL migration；最新 `20260917080000_v15_package_checkout`。完整名稱與 SHA-256 見 `evidence.json`。
- 最後 schema 修改 commit：`8bc4e72`（package checkout）；之前 `fa4fc0b`（packages）、`0a29aca`（placement）。commit author 不能代替 Schema Owner 指派。
- repository 未找到 AGENTS.md / CODEOWNERS 或具名 schema owner assignment。Sprint Plan §49–50 僅要求唯一 Owner。
- **Owner 未確認；本輪零 schema / migration 修改、零 migrate deploy。** proposal 交由唯一 Owner 審核並安排 migration prefix。

## D. Reusable infrastructure

| 能力 | 實作 | 重用限制 |
|---|---|---|
| Idempotency | `common/idempotency/idempotency.service.ts` | actorScope+key unique、request hash、Serializable、response replay；不同事件鍵仍需 business unique key / row lock；外部網路呼叫不得放 transaction callback |
| Outbox | `common/outbox/outbox.service.ts`、`packages/database/src/outbox-lease.ts` | 同交易 enqueue、CAS lease、retry/DEAD；現有一列只有一份 processStatus，不能直接當多 subscriber fan-out acknowledgement |
| Worker | `backend/apps/worker/src/main.ts:187` 附近 `pollOutbox` | 只接收明列 Core event types；新 Commerce worker 不得搶 Core queue。`MEMBER_ORDER_CREATED` 分支不在 query allowlist，列既有 dispatch drift |
| Audit | `common/audit/audit.service.ts` / interceptor | 高風險操作必須用 transaction domain audit；HTTP interceptor 為 best effort，不能替代。避免 serial/PII 放 URL，因 interceptor 保留 originalUrl |
| Auth/RBAC | `modules/auth/{admin-authentication.guard,admin-role.guard,roles.decorator,qualification-access.service}.ts` | 現為單一 role code exact-match；新角色不會自動可用。warehouse API 放 `/admin/warehouse` 才沿用現有 Admin prefix guards |
| HTTP | `common/filters/api-exception.filter.ts`、`common/interceptors/envelope.interceptor.ts` | success `{data,meta}`；error 為頂層 `{code,message,details?,request_id,timestamp}`；409 conflict / 422 validation / 503 unavailable |
| Provider pattern | `modules/auth/line-token-verifier.ts`、`sms-otp-provider.service.ts` | server-only verifier、dependency injection、timeout、safe error、未設定 fail closed；不是付款簽章規格 |
| PII | `common/security/pii-crypto.service.ts`、delivery profile versions | 已有 key-versioned AES-GCM pattern；provider secret 仍走 Key Vault/environment，不能存 DB plaintext |
| Tests | `scripts/db-golden-isolated.mjs`、`api-jest-isolated.mjs`、`phase3-concurrency-db-test.mjs`、`phase3-return-outbox-db-test.mjs`、`package-checkout-db-test.mjs` | localhost-only random DB、migrate-from-zero、fixture、HTTP/DB assertions / cleanup；不能接共享 DEV 或 Stage DB |

Outbox `releaseFailedOutboxLease` 會保留 exception message；Provider adapter 必須先轉為安全 error code，不可直接傳 upstream body。Idempotency responseBody 同樣不可存 PAN / CVV / full track / secret / 完整地址。

## E. Core / Member conflicts

- Core task「繼續第三階段 TODO Burn Down」在本輪讀取時為 active；可讀 API 沒有返回 turn items，無法證明其未提交檔案或當前修改清單。沒有向其他任務發送指令。
- `codex/backend-phase3` = `73bb9282c7fdd456e60848976cd939a9bb9b9a9b`，相對基線獨有 0 commits、基線獨有 164；該舊支線名稱不能當作目前 Core 工作位置。
- `feature/member-liff-mvp` = `f12b164b17eed5352748e4394029efac25361b55`，相對基線 Member 獨有 8、基線獨有 232 commits。Member 獨有改動含 `member/src/App.tsx`、`Shop.tsx`、`commerce.tsx`、Admin AppShell/ProductsPage、lockfile、`shared/products.json` 與品牌素材。完整差異見 evidence。
- GitHub open PR list 在本輪為空；不代表沒有未推送/未開 PR 的工作。
- 衝突熱點：Prisma、Order/Payment service、PackageConfig、Member DTO/checkout、Admin permissions/routes、generated OpenAPI、Worker dispatch、test harness、package manifests。
- B1 提議只新增 contracts 與測試，既有接線由 Owner 排程。UI 與 shared catalog 不動。不得為取得產品 display data 而把 Member 分支零售價當 recognition config。

## F. Missing schema

`SCHEMA_PROPOSAL.md` 列出各 domain 的新表與 keys/constraints。至少缺 Payment aggregate/attempt/verified evidence/reconciliation/POS/refund；Warehouse/Item/Balance/Reservation/Movement/Lot/Serial；Fulfillment/lines/picks/scans/parcels/serial shipment binding；QC version/check/evidence；Shipment/label/tracking；Invoice/action；RMA operational overlay + original ReturnCase link；ERP connection/sync/mapping/reconciliation；fan-out delivery evidence。

不重建 Order/Product/Package/ReturnCase。`InventoryReservation`、lot balance bucket、serial shipment claim、RMA-to-ReturnCase unique link 是規格簡表之外為 invariant 所需的提案，尚待 Schema Owner review。

## G. Missing APIs / contract drift

`API_PROPOSAL.md` 與 `openapi.proposal.json` 為新 API proposal，未安裝 endpoint。

1. 缺 payment create/status/webhook/query/reconcile/POS/refund；shipping choice/store snapshot；inventory receipt/reserve/release/adjust；pick/scan/complete；QC；pack/label/dispatch/tracking；invoice；RMA；serial trace；ERP config status/reconcile。
2. 已提交 `backend/openapi.generated.json` 未包含現有 package API；MemberCreateOrderDto 仍只列 qualificationId/items。`openapi-preflight.mjs` 甚至只允許這兩欄，與 package source DTO 已偏離。**本輪既有 preflight PASS，但 contract completeness FAIL（source/spec drift）**；由 shared OpenAPI Owner 修正 exporter/test 後重產，不手改既有 generated 檔。
3. 現有 product `available` 僅來自 isActive，非 stock availability。
4. 現有 manual payment 及 Return controller class-level roles 包含 COMPLIANCE_AUDIT，方法未覆寫 roles；目前 guard 僅 exact-match，靜態上 auditor 可走 mutation。需安全 Owner 逐 operation 修正並做 HTTP 驗證，不能盲目複製到新 API。
5. `ReturnService` 使用 lineAmount 依比例計算；package lineAmount=0、Order.netAmount>0。需 Core 提供 package return allocation/recognition boundary；不能自行分攤。
6. 現有 checkout 沒有交易內庫存/配送 snapshot 檢查；Member UI delivery gating 不能視為 backend authority。零 Qualification 普通購物仍受既有 non-null Order.qualificationId/holder check 限制；交由 Core/Member Owner 決定 scope，不由 Commerce 偷改。

## H. Missing tests

20 項指定 Golden 的「Commerce/provider end-to-end」均未找到完整實作測試；既有 payment idempotency、return replay、Package immutability 等可作局部回歸，不代表 Golden 已 PASS。`TEST_PLAN.md` 列各 case 的 fixtures、HTTP/DB oracle、concurrency 與 failure injection。

## I. Provider prerequisites

- B2：台新實際 merchant API 版本、簽章 canonicalization / encoding / key rotation、事件身分及重送語意、capture/settlement/query/refund 規格、sandbox merchant、callback registration、TLS/network allowlist（若契約要求）；僅提供 secret reference，勿貼 secret。POS 需 terminal/batch/transaction 唯一性、verified reconciliation SOP 與付款判定門檻。
- B3–B5：initial stock count/import evidence、SKU tracking / serial normalization、lot expiry threshold/timezone、FIFO/FEFO/warehouse allocation、partial fulfillment/backorder、QC checklist/label sequencing、操作人員角色。未定政策僅阻擋相關執行路径。
- B6：黑貓／7-11 direct 或 approved aggregator route、store validation/map、label sandbox、tracking/cancel/return webhook spec。
- B7：Invoice provider 決定、invoice issue trigger/version、buyer/tax/rounding 與 void/allowance SOP。不得猜稅務規則。
- B8：ECPay Payment、LINE Pay merchant docs/config/UAT，與發票／物流服務分開。
- B9：package refund allocation 與 original recognition reference、serial/disposition SOP。
- B10：BC tenant/environment/company/API/auth scopes、external ID mapping、domain SoR cutover approval、shadow reconciliation/outage policy。ERP=NONE 不依賴 BC secret。

本輪未查詢外部 provider 細節，亦未選定演算法或虛構 sandbox evidence。

## J. Proposed branch

`feature/commerce-fulfillment-b1-contracts`，由核准 integration checkpoint 建立獨立 checkout/worktree。Schema Owner、Core、Member scopes 確認後才切；不是現在共用目錄直接 checkout。

## K. Proposed B1 exact files

見 `OWNERSHIP_PLAN.md`。B1 限 canonical types、adapter/Core seams、contract tests 及本提案 freeze；無 provider implementation、無 runtime wiring、無 migration。Schema proposal 由唯一 Owner 另批接手，不把 B2–B10 提前合在 B1。

## L. Safe to begin B1?

**否：B1 BLOCKED。**

必要 blockers：

1. 尚無具名唯一 Schema Owner / schema review & merge checkpoint。
2. Core active task 的 live branch / changed-file ownership、Member/UX live scope 尚未確認；遠端 branch 歷史不是工作鎖。
   Closing delta 已證實 integration 同時新增 payment-hub interface/transition/tests，須明確移交此範圍。
3. 需要把 B1 contracts 的 authoritative payment -> existing Core payment evidence、ReturnCase POSTED event bridge 及共有檔案修改責任凍結。現有 manual payment 並不驗證 provider，不能直接公開作 webhook handler。

Gate 0 已有 repository engineering checkpoint PASS 記錄，但尚無本輪 B1 對應的 branch/ownership checkpoint 證據。Production Go/No-Go 不是本輪 B1 的必要條件；provider credentials、Active-policy 等只阻擋相關後續路徑。

另需 Core 保持 fail closed：package recognition resolver、Active-duration stacking/start/renewal、package return allocation、歷史 GPV->PV/BV mapping。這些不授權 Commerce 改 monetary logic。

## 驗證與限制

| Gate | 本輪狀態 |
|---|---|
| 完讀 product-next | PASS：基線全部 50 個 Markdown，另完整補讀 closing delta 兩個新增 REPORT；見 manifest / closing-delta |
| repository 內 R1.0B governance / related implementation docs | READ；CURRENT_SSOT_POINTERS 所指報備文件/完整手冊原件不在 checkout，未宣稱重驗原件 |
| schema-preflight | PASS（靜態） |
| migration-preflight | PASS（39 個 migration 靜態） |
| openapi-preflight | PASS（既有腳本）；source/package contract completeness FAIL |
| security-policy-preflight / test-todo-gate | PASS（靜態）；不代表 HTTP RBAC PASS |
| Build / Prisma generate / from-zero deploy | NOT RUN：本輪 proposal only |
| Unit / Integration / HTTP / DB / concurrency / BOLA Golden | NOT RUN：未宣稱既有報告為本輪結果 |
| Provider Mock / Sandbox-UAT / Production | NOT RUN / NOT VERIFIED / NOT READY |
| Commit | 無新 commit；基線 SHA 如 A |

提案間一致性與完整性檢查結果記錄於 evidence.json。未更新或刪除任何歷史 evidence。
