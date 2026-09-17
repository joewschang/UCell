# Provider event identity / payment effect boundary review

本轮讀取 integration checkpoint `8dc0be7a543679891b282fc1d7eaed1c89c6bc24`，新增 commit `feat(payment): canonicalize provider event identity`。完整新增程式、tests 及 V1_20 report 已審閱，compare 保存在 delta.json。Local checkout 仍為 detached `2176b049dde32300e5023bcb7088d89890fec519`，未更動 runtime/schema/migration，未建立 commit 或推送。

## 本輪結論

新 canonicalizer 可提供 deterministic sanitized evidence hash，但不能單獨保證 webhook/query race 只入帳一次。驗證 14 項中 9 PASS / 5 FAIL；其中五個 PASS 為「觀察到的限制」，不能計為 business idempotency 驗收通過。原先 22 項測試的相關 helper 不在本次 diff 內，沒有證據可將其 8 個 FAIL 關閉；本輪也未重跑或覆寫舊快照結果。

| Case | Result | 含義 |
|---|---|---|
| E01/E02/E03/E14 | PASS | metadata key order 穩定、空 event ID 拒絕、明確 event ID 保持而 business hash 改變、signature redaction 後 hash 穩定。 |
| E04 | Observed limitation — PASS | 沒有 explicit ID 時，相同 transaction/status 經 webhook/query 產生不同 event identity。不能只依這個 identity 去重付款 effect。 |
| E05 | Observed limitation — PASS | 同 explicit ID 跨 source 時 identity 相同、hash 不同；如果兩個 source 都使用同一 event ID，現行 hash classifier 會判 CONFLICT。Provider adapter 需明確 event ID namespace 語意。 |
| E06/E07 | Observed limitation — PASS | occurredAt 或 correlation metadata 改變會改變 fallback identity。receivedAt 不可冒充 provider occurredAt；request correlation 不應決定 business operation identity。 |
| E08/E09/E10 | FAIL — boundary proposal | runtime browser source、未知 provider、未知 status 均可建構回傳物件。TypeScript 排除不等於 ingress runtime 驗證。 |
| E11 | FAIL — evidence integrity | 回傳 occurredAt 沿用 caller Date reference；caller 修改 Date 後，回傳 evidence 時間改變但 payloadHash 保持。需複製/不可變表示，並在持久化前保證 canonical bytes 一致。 |
| E12 | FAIL — evidence integrity | NaN 沒被拒絕，進入 hash。 |
| E13 | Observed limitation — PASS | NaN 與 null metadata 產生相同 hash，證實 sanitizer finite-number 缺口會延伸至 evidence integrity。 |

這些是隔離 helper 與未凍結的安全邊界測試；尚未發現或驗證可從公開 API 到達的攻擊路徑。上游 V1_20 報告的 build/Jest PASS 是其提交附帶報告，不列為本輪執行證據。

## 待凍結的 contract：三種身分各自負責

1. **Delivery identity**：識別 provider 重送的同一則通知。由 provider 契約決定 event ID 的作用域，可能需要 connection/merchant scope。只有 provider enum 的 namespace 不足以自行推論跨 merchant 唯一性。沒有正式事件 ID 的 provider，不猜可替代的永久身分。
2. **Evidence identity / hash**：保存經驗證的安全證據內容。hash 可包含來源與 provider 時間，以利辨識證據差異；它不是 PAID effect 的唯一鍵。transport request ID、接收時間、trace/correlation 應有自己的欄位，與 canonical business fields 明確區隔。
3. **Business operation / effect identity**：同一 payment 的同一 capture/payment-confirmation operation，無論由 callback、query、reconciliation 發現，對 Core 的 payment-confirmation effect 只能成功一次。partial captures/refunds 必須有不同的正式 operation identity；禁止簡化成 `(transactionRef,status)` 而吞掉合法多次 refund。

以上為 Commerce proposal，不任意指定台新的唯一键或重新解释 Core monetary semantics。Receipt 必須綁定 payment/order、provider connection、provider transaction/operation、金額、幣別與 verification provenance。待正式 provider 規格決定 identity recipe，未知 recipe fail closed。

## Transaction / outbox proposal（無 DDL）

| 階段 | 必須保證 |
|---|---|
| Adapter verification | 驗簽或透過受信任 query/reconciliation 取得結果；browser 只能導航。正式 normalization 與安全欄位 projection 完成後才建立 verified receipt。 |
| DB transaction | 綁定既有 payment；驗證 order/amount/currency；依 receipt identity 判 replay/conflict；按 payment aggregate 狀態做條件更新；同交易插入唯一 business effect claim 與既有 Core contract 的 outbox intent。 |
| Race loser | 讀取已提交結果，回傳 replay 或明確 conflict；不能再次生成 Core payment-confirmation effect。retry 整筆交易，不呼叫外部 API 作 transaction 內的補償。 |
| Outbox consumer | 按 effect identity 重試，使用既有 Core idempotency contract。deliver-once 不作假設；handler 重跑必須不重認列。 |
| Evidence conflict | 保留兩次安全證據及 correlation 關聯，阻擋有衝突的 transition；既有已提交 business evidence 不可被覆寫。敏感 raw body 不進 Git/DB/log。 |

原先 schema proposal 需由唯一 Schema Owner 增補對上述三層 identity 的欄位／unique constraint review。此處沒有產生 migration，也不預設既有 Core handler 接受尚未核准的新 event name。

## 後續 DB/HTTP acceptance scenarios（本輪 NOT RUN）

| Scenario | Required oracle |
|---|---|
| 同一 verified webhook 同時送兩次 | 一個有效 payment transition、一個 Core effect claim；兩筆 delivery 可 audit，無第二次 monetary recognition。 |
| webhook + query 同時證明同一 operation | evidence 可不同、business effect 只有一個；依既有 payment lock/CAS 與 unique claim 驗證。 |
| 重送時 correlation/receivedAt 不同 | 不產生第二個 payment effect；保留兩次 transport metadata。 |
| 同 event ID 金額/幣別/order 改變 | conflict，不覆寫歷史 receipt、不產生 effect。 |
| 同 provider 不同 merchant/connection 的相同 event ID | 依正式 provider scope 區隔；BOLA 不能跨 connection/order 使用 receipt。 |
| 同 transaction 的兩次合法 partial refund | 各有不同 operation identity，各正確處理一次；不能用 status 去重而吞掉第二次 refund。 |
| transaction commit 後 worker crash / recovery | 重試後仍只產生既有 Core contract 容許的一次 effect。 |
| invalid source/status/provider 或未驗證 receipt | HTTP ingress 拒絕且 DB payment/effect/outbox 不變。 |
| NaN/Infinity、Date alias、metadata mutation | persisted canonical evidence 與 hash 永遠一致，非 JSON 值拒絕。 |

## Exact changed files / gate

本輪實際新增只在 `governance/commerce-event-identity-review/`：REPORT.md、snapshot.json、delta.json、probe.mjs、results.json。前三份來源 content 的 Git blob hash 均驗證 PASS；SHA-256 記錄在 results.json。Node transform 只為執行隔離快照，並非 TypeScript typecheck。

重現：`node governance/commerce-event-identity-review/probe.mjs`；目前 exit 1，9 PASS / 5 FAIL。未執行 app build、from-zero migration、HTTP、DB concurrency、20 Golden、provider Mock 或 Sandbox/UAT；Production 未就緒。

建議 B1 branch 保持 `feature/commerce-fulfillment-b1-contracts`。新 canonicalizer 及其 test 也是現有 writer 的共享範圍，移交前不修改；前輪 12-file B1 list 若要納入，需在 ownership inventory 明確增列 `backend/apps/api/src/modules/payment-hub/provider-event-canonicalizer.ts` 與 `backend/apps/api/test/provider-event-canonicalizer.e2e-spec.ts`。

**B1 BLOCKED**：唯一 Schema/migration Owner 尚未指定；Core 任務在本次讀取時又為 active，無可讀的 live changed-file inventory；Member ownership 與 Payment Hub writer handoff 未確認。使用者的「繼續」授權持續完成 audit/proposal，不能代替其先前明確要求的 ownership 證據。確認 owner、範圍及 Core bridge 後，才可建立已提議支線並開始 B1。
