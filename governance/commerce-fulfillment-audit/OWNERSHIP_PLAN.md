# Branch / file ownership proposal

本文件不構成 Owner 任命。等待使用者/Core coordinator 指定唯一 Prisma/migration Owner 與 live branch/checkpoint；此前 B1 BLOCKED。

| Scope | Proposed responsibility | Current confirmation |
|---|---|---|
| `backend/packages/database/prisma/schema.prisma` / `migrations/**` | 唯一 Schema Owner（建議 Core integration Owner） | 未指定 |
| `modules/{bonus,active,qualification,subscription,adjustment,settlement,payout,return}/`、ledger/rules/history | Core Owner；Commerce read-only | protected scope 已知，live file lock 未確認 |
| `modules/order/` / package-config / recognition / ReturnCase bridge | Core + Commerce contract review；每批一位 writer | 未確認 |
| `member/**` / `admin/**` / `shared/design-system/**` / shared product catalog | Member/UX Owner | 遠端 Member 分支已辨識，live lock 未確認 |
| new commerce contract files | Commerce Track | proposed B1 scope |
| AppModule / Worker main / auth guards / common infra / generated OpenAPI / package scripts / lockfiles | Integration Owner 統一接線與 regeneration | 不由 Commerce 自行改 |

## Proposed branch

`feature/commerce-fulfillment-b1-contracts` from approved `integration/member-backend-mvp` checkpoint。先以固定 SHA 稽核；若 integration 前進，先 compare 新 commit/file list 與 schema hash，再更新 proposal，不暗中 rebase Core 工作。

## B1 exact runtime changed-file list — only after gate

Closing delta 後修訂：沿用新加入的 payment-hub，不建立第二份 canonical payment。以下為提議的精確 runtime 清單，尚未開始；現有檔案須原 writer 移交後才改：

1. `backend/apps/api/src/modules/commerce/contracts/common.ts`
2. `backend/apps/api/src/modules/payment-hub/payment-provider.adapter.ts`（既有，協調擴充；不建立 commerce/contracts/payment.ts）
3. `backend/apps/api/src/modules/commerce/contracts/inventory.ts`
4. `backend/apps/api/src/modules/commerce/contracts/fulfillment.ts`
5. `backend/apps/api/src/modules/commerce/contracts/logistics.ts`
6. `backend/apps/api/src/modules/commerce/contracts/invoice.ts`
7. `backend/apps/api/src/modules/commerce/contracts/rma.ts`
8. `backend/apps/api/src/modules/commerce/contracts/erp.ts`
9. `backend/apps/api/src/modules/commerce/contracts/core-boundary.ts`
10. `backend/apps/api/test/commerce-contracts.e2e-spec.ts`（沿現有 runner 命名；僅 contract/negative boundary，不能冒稱 provider HTTP E2E）
11. `backend/apps/api/src/modules/payment-hub/canonical-payment-transition.ts`（既有，僅凍結後補 evidence boundary / canonical convergence）
12. `backend/apps/api/test/payment-hub-contract.e2e-spec.ts`（既有，補 POS verification / ingress negative contract tests）

Adapter definitions 先由 `ADAPTER_INTERFACES.proposal.ts` split；canonical JSON contract 需要 runtime validation 時先讓 Owner review 範圍再擴名單，不在本清單假裝已有 schema/controller。

B1 governance outputs：本目錄 REPORT、SCHEMA_PROPOSAL、API_PROPOSAL、ADAPTER_INTERFACES.proposal.ts、TEST_PLAN、MIGRATION_IMPACT、OWNERSHIP_PLAN、openapi.proposal.json、evidence.json、validate-proposals.mjs、CLOSING_DELTA.md、closing-delta.json。批准後更新 status/freeze receipt。實際本輪檔案清單見 evidence.json。

## Coordination protocol

1. Owner 指定（人/任務/branch）、Gate0 integration SHA、Core/Member changed-file inventory。
2. Freeze canonical vocab、payment/Core receipt、RMA/Core posting bridge、API response/errors、migration proposal review。
3. Commerce 開始 B1 contract-only，Core shared files 為 read-only。
4. Schema Owner 根據後续 batch proposal 單獨產生 forward migration，檢查 baseline hash 與 prefix collision。Commerce 只能提交提案，不能自行合併 DDL。
5. Integration Owner 合入已通過測試的 contract slice，再決定 B2 adapter + provider-verification authority gate。

No parallel self-assigned Prisma edits；不據 shared `UCell Dev` 路徑推論其他任務內容已安全隔離。
