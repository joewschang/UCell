# Test plan / Golden coverage proposal

全案目前 NOT RUN；本輪沒有實作新的 provider/warehouse endpoint。既有 tests 僅作可重用 regression，不把 fixture PASS 混成 provider UAT。每批保留 source SHA、command、exit code、DB evidence、failure details、changed files、known blockers。

## Harness

- 使用 `backend/scripts/db-golden-isolated.mjs` 的 localhost-only random DB/migrate-from-zero pattern；Commerce 新 suite 另建 runner，Schema/Integration Owner 才修改共用 runner。
- 每次使用 disposable dataset，至少兩個獨立 DB connections 模擬 race；barrier 同時提交，觀察 commit/409/retry，不能以 sequential Promise mock 代替競爭。
- ASSERT after transaction commit，重新讀 DB，不只 assert response。Snapshot 原 PaymentEvent/OrderLine/Package/ledger/award/replay evidence hashes，測完比對。
- 注入 clock/provider transport/queue failure。secret sentinel / PAN-like / CVV sentinel 放測試輸入，掃 log/DB/outbox/idempotency artifacts 確認未保存；不使用真卡號或 production secret。
- Raw signatures：B2 需台新正式 spec test vector + tampered/encoding/body-order/wrong key/replay sample；自造 HMAC mock 不能證明台新支援。
- 401 unauthenticated；403 role denied；foreign order/shipment/serial關聯拒絕；warehouse scope、same-Person cross-Ball、auditor read-only 與 stale role revoke 需 HTTP 測。

## Twenty required journeys

| ID | Journey / batch | Fixture / action | Required oracle |
|---|---|---|---|
| G01 | 台新 online -> PAID -> reserve -> pick/serial -> QC -> 黑貓 -> invoice -> delivered（B2–B7） | explicit package recognition reference、1 stock serial、configured mock providers；HTTP 每一關 | 1 verified capture / paid bridge / reservation / shipment；QC 6 checks；獨立 invoice receipt；Core 未推算 PV/BV；全程 correlation links |
| G02 | 7-ELEVEN pickup（B6） | validated store snapshot，之後改 Member profile / store selection | shipment 保留原店 snapshot；建立後不能靜默改店；tracking normalized，owner-only read |
| G03 | 台新 POS（B2） | same terminal/batch/transaction 重複輸入；verified batch amount match/mismatch | 初始 pending；未達政策不得 paid；重複不重複付款/recognition；mismatch 保持 exception |
| G04 | duplicate payment webhook（B2） | 同 event ID 多次及不同 event ID 指同 capture | 一份 verified event identity；一次 business paid effect / Core receipt / downstream job；相同 ACK |
| G05 | browser redirect before webhook（B2） | redirect success=true，無 verified callback | 狀態仍 pending，無 inventory/recognition；後來 verified evidence 才變更 |
| G06 | webhook/query race（B2） | 兩連線 barrier，同一 provider transaction；加 stale failed callback | 一個 canonical paid transition；不得退回 failed；一份 Core PaymentEvent/effect key |
| G07 | last inventory unit race（B3） | onHand=1，两 paid orders 同時 reserve | 只有一個成功；另一個 409/stock exception；available=0，movement/reservation 不重複；多 line 失敗整筆 rollback |
| G08 | duplicate serial scan（B4） | 同 key 重送；換 key 重掃；兩 fulfillment 同掃 | 同 key 回原結果；新 command duplicate 拒絕；active serial claim 唯一，qty 不增加 |
| G09 | wrong SKU scan（B4） | task for A，scan B（lot/serial真實存在） | SKU_MISMATCH；無 serial assignment/pickedQty/movement effect，安全拒絕 evidence |
| G10 | expired/invalid lot（B3–B5） | exact policy cutoff 前/等於/後、quarantine、foreign item lot | approved policy 決定 boundary；invalid/expired 拒絕；缺政策 fail closed；LOT_SERIAL 同時符合兩者 |
| G11 | QC FAIL blocks shipment（B5–B6） | FAIL/HOLD/缺 check/過期 PASS；PASS 後換 parcel/serial/label | create/dispatch 被擋；重新 QC 才可；不能 override 為假 PASS；理由/actor/time/correlation 完整 |
| G12 | duplicate shipment callback（B6） | duplicate / out-of-order DELIVERED then IN_TRANSIT | 一個 tracking event effect；不倒退；SHIP inventory 只扣一次 |
| G13 | invoice issue/void/allowance（B7） | lost response retry、duplicate callback、partial allowance 累計 | 各 action 独立 key；無 duplicate invoice/allowance；PAYMENT=PAID 不代表 issued；amount cap/versioned policy |
| G14 | RMA serial return（B9） | original serial、別訂單 serial、已退 serial、偽造 line | 僅原 shipment serial 可 received/post；cumulative quantity/value cap；immutable receipt/disposition |
| G15 | POSTED fan-out（B9） | Inventory 成功、refund timeout、invoice fail、Core replay missing snapshot | RMA 仍 POSTED；四條 workflow 各自 retry/evidence；後續 retry 只補失敗；原 monetary evidence 不改 |
| G16 | ERP NONE（B1/B10） | 無 BC environment/secret、provider=NONE | Commerce 能執行；零 BC calls；inventory authority=UCELL，不能把未 sync 誤報 BC success |
| G17 | BC idempotent sync（B10） | 同 outbox / lost response after external commit | query/reconcile external reference 後重試，1 mapping/external effect；相同 UCell IDs |
| G18 | BC outage/recovery（B10） | timeout/offline/401 + restart lease expiry | queue durable；不在 DB transaction dual-write；approved degraded policy/fail closed；recovery convergence |
| G19 | BC mismatch（B10） | quantity/amount/reference mismatch + stale watermarks | MISMATCH/INCOMPLETE evidence，不自動切 SoR/overwrite；review audit；重 reconcile 明確 new evidence |
| G20 | historical immutable（all） | package改版、member地址改、return/replay、SQL UPDATE/DELETE evidence | 原 snapshot/hash/serial shipment/payment/ledger不變；DB拒絕歷史改寫；更正 append only |

Golden completeness 還需 ECPay Payment / LINE Pay 在 B8 各自通用 payment contract suite；20 項不是省略 B8 測試的理由。

## B1-only gates

- Canonical enums 與 aliases freeze；PAID/Invoice/Shipment 分離；所有 provider-specific DTO 局限 Adapter。
- Negative contract tests：browser return / unverified boolean 不能作 verified evidence；無 recognition reference 只能 pending；ERP NONE 不要求 BC adapter；不允許 floating point monetary payload。
- Test isolation/compile / forbidden Core imports review。B1 無 migration，但須在新 branch 按 DoD 重跑 baseline from-zero/Build/regression，不能以 schema unchanged 直接宣稱 PASS。
- 本輪 `.proposal.ts` 只宣告介面、沒有 verifier 實作；型別品牌不是 runtime security。真正的 negative signature / HTTP gates 在 B2。

## Additional invariants

- API idempotency lookup 前 auth/ownership；lost response retry 保持 request ID/meta規範；不同 principal key 不得讀前人 payload。
- Return amount allocation for package、zero-Ball ordinary checkout、QC label ordering unresolved 時，相關 production path CONFIGURATION_PENDING，不以新增 test fixture 替代政策。
- `WorkflowEffectDelivery` 必須每 subscriber 獨立 ACK；Core Worker 只接原 allowlist，Commerce Worker 只接自己的 event types。
- No external calls while DB locks held；payment/logistics/invoice external success but local timeout -> RECONCILE_BEFORE_RETRY。
- Fake serial PII 不得出現在 originalUrl / logs；trace request body不進 audit。Trace輸出會員信息依 role 遮罩；AUDITOR 無 mutation。

## Per-batch reporting matrix

Build、migration-from-zero、unit、integration、HTTP、DB assertions、idempotency、concurrency、BOLA/IDOR/RBAC、Golden、OpenAPI source parity、audit evidence、changed-file inventory、commit SHA、known blockers 每項獨立填 PASS/FAIL/BLOCKED/NOT RUN。

Provider 三欄強制分開：Mock / Sandbox-UAT / Production Ready。Mock PASS 不可複製到另兩欄。Deployment credentials、merchant operational SOP、實體倉庫裝置/UAT 另附可追溯 evidence。
