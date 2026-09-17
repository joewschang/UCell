# Closing delta — 已確認實際跨支線重疊

固定稽核 checkout：`2176b049dde32300e5023bcb7088d89890fec519`。
結束前遠端 observation：`98a69992940fb00c89b592aa964614a1c7e4cce5`。
比較來源：GitHub compare API，完整 commit/file patches 見 `closing-delta.json`。本機未自動 rebase / checkout 新 HEAD；baseline static checks 僅屬 2176b04。

## Changes read in full

1. `df2547d7a04e0985b69ba163c7329aed714a83ec`：`feat(payment): add canonical provider contract`。
   - 新增 `backend/apps/api/src/modules/payment-hub/payment-provider.adapter.ts`。
   - 新增 `backend/apps/api/src/modules/payment-hub/canonical-payment-transition.ts`。
   - 新增 `backend/apps/api/test/payment-hub-contract.e2e-spec.ts`。
   - 新增 `governance/product-next/V1_16_PAYMENT_HUB_CANONICAL_CONTRACT_REPORT.md`。
2. `98a69992940fb00c89b592aa964614a1c7e4cce5`：`fix(organization): connect binary placement command`。
   - Organization controller/module、Qualification module、Organization tests、V1_17 report 更新。
   - Commerce 不修改此 Core scope。

兩個新增 product-next REPORT 已完整閱讀；因此閱讀範圍為固定基線 50 檔 + closing delta 2 檔。比較未出現 schema/migration 變動，仍為 39 migrations。

## Updated inventory

最新 integration 已有 provider-neutral payment interface / 純 transition validator / 9 項 contract tests（測試數為該 commit 報告，未由本輪執行）。仍無 payment persistence、provider cryptographic verification、Taishin adapter、DB race / reconciliation workflow。REPORT B 的「無 Payment Hub」僅適用原固定基線，現在以此 delta 補充。

V1_16 report 明確列「designated Prisma schema owner」為 remaining gate，支持 Owner 尚未被此次資料證明的結論。

## Required contract convergence

- 不能再在 commerce/contracts 建一個平行 PaymentProviderAdapter。新 B1 必須重用既有 payment-hub；現有 Payment code writer / review owner 需先指定。
- 既有 canonical status 同時含 CAPTURED、PAID、REFUND_PENDING；本提案用 PAID alias + 獨立 refund workflow。這是未解決的 contract difference，不可單方面刪 status 或變更已發布型別。
- 現有 `CONTROLLED_POS_EVIDENCE` 只驗 transaction/operator/terminal-or-batch 即允許 PAID，沒有 verified reconciliation policy receipt；使用者指定「verified provider callback/query/reconciliation 才 paid」與此處尚未對齊。凍結前不得當成正式付款 authority。
- `PROVIDER_QUERY` 只檢查 transactionRef，`RECONCILIATION` 只檢查 transactionRef+batchRef；需要不可由公網 body 偽造的 server-owned verification boundary。signatureVerified boolean 只是一個欄位，不是簽章實作。
- `current===next` 提早返回，不代表能跳過 ingress verification/inbox dedupe；valid duplicate 必須先驗 authenticity。
- `classifyProviderEvent` 是 hash 比較純函式，不提供 DB unique key、payment row lock、transactional outbox 或 exactly-once business effect。
- 保留 raw bytes/context/configVersion/amount/currency/order binding、安全 evidence、reconcile-before-retry 等本提案要求，但以既有 interface 的 coordinated extension 提交，不能另造第二個 canonical。

## Readiness

**B1 BLOCKED**：實際 payment file scope 重疊已發生；需要唯一 Schema Owner、payment-hub writer ownership 與 Core/Member branch/checkpoint。新契約已存在並不解決 ownership gate。

此次 proposal 沒有套用 delta、不修改新 contract、不執行 provider 或 Core tests。最新 integration build 與它的報告數字不列為本輪 PASS。
