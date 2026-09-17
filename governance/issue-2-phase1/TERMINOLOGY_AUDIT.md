# Terminology audit

Domain enums and evidence codes remain unchanged. This document governs user-facing labels only.

## Preferred vocabulary

| Concept | Primary UI label | Detail/code treatment | Avoid or constrain |
|---|---|---|---|
| Person | Member: `會員帳戶`; Admin: `自然人（Person）` | Show immutable Person ID in detail | Do not call a Person a ball |
| Qualification | `經營資格` | First mention may use `經營資格（Qualification／球位）`; display `Q-code｜rank｜球 n` | Avoid switching freely among 資格/球/球位/Ball |
| Active | `資格狀態：有效／未有效` | Preserve Active interval/evidence | Do not equate Active with monthly repurchase |
| Repurchase | `本月重購狀態` | Show recognition period and events | Nav currently says 重銷; standardize to 重購訂閱 |
| Sponsor Tree | `推薦組織` | Detail may show Sponsor Tree | Never call it Binary organization |
| Binary Tree | `二元安置組織` | Detail may show Binary Tree/side | Never use it for Matching Sponsor traversal |
| Award | `獎金項目` | Show Award ID and domain status in detail | Avoid unexplained Award in primary copy |
| Ledger | `入帳與調整紀錄` | Preserve Ledger/source/event IDs | Do not imply mutable balance rows |
| Settlement | `結算批次／結算證據` | Show rule/parameter/calendar/hash | Keep separate from payout |
| Payout | `付款批次與對帳` | Preserve payout status and external reference | Do not imply UCell performs bank transfer |
| Return | `退貨案件` | Preserve lifecycle code | Refund and volume reversal are separate |
| Replay | `歷史重算（Replay）` | Show ReplayRun/checkpoint/evidence | Never suggest current-state recalculation |
| Clawback | `追扣／抵扣調整` | Preserve `CLAWBACK` code | Do not say original PAID row was changed |
| PENDING45D | `45日等待期` | Preserve enum in detail | `等待生效` alone loses the 45D distinction |

## Null and availability vocabulary

| Condition | Display |
|---|---|
| Monetary result pending | `結算中` |
| API field defined but not supplied | `尚未提供` |
| Read model does not exist | `功能資料尚未接入` |
| No matching records | `目前沒有資料` |
| Configuration missing | `設定待核准` |
| Credential evidence missing | `正式驗證待執行` |
| Request failed | `暫時無法載入` plus retry/context |
| Unauthorized | `沒有權限查看此資料` |

`unavailable`, `待提供`, `待確認`, `—` and `尚未提供` must not be interchangeable. Technical detail may show the authority status code defined in `UX_AUDIT.md`.

## Status labels

| Enum | Member/Admin primary label |
|---|---|
| `CALCULATED` | 已計算 |
| `PENDING45D` / `PENDING_45D` | 45日等待期 |
| `EFFECTIVE` | 已生效 |
| `PAYABLE` | 可支付 |
| `PAID` | 已支付 |
| `REVERSED` | 已沖回 |
| `CLAWBACK` | 追扣／抵扣調整 |
| `DRAFT` | 草稿 |
| `SUBMITTED` | 已送審 |
| `SUSPENDED` | 已停權 |

## Known terminology risks

1. Products and Orders still contain `GPV Rate`, `金額/GPV` and `Outbox產生PV` copy. Prospective PV and BV are independent fields; UX must not reinterpret historical GPV or assert a mapping.
2. Admin nav uses `重銷方案` while pages/guides use `重購訂閱`. Use `重購訂閱` unless SSOT gives a more specific program name.
3. `獎金／帳本`, `獎金／結算營運` and `結算／付款` overlap. Use `獎金與結算證據` for calculation evidence and `付款批次與對帳` for payouts.
4. Member Binary `volume` lacks an approved PV/BV/GPV label. Display `左右區業績（Core 回傳）` until the read model defines its unit.
5. Workflow copy contains a fixed `Review Fee NT$600`. UI must display an authoritative response/config value or cite an approved rule; it must not become the rule source.
6. Admin System version/gate labels are static and can become stale. Display source and as-of time when retained.
