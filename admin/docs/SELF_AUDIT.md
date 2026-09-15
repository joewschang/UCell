# Admin MVP v0.1.0 Self Audit

## A. 與 R1.0B 制度一致性

PASS：
- Person / Qualification 在UI文案與資料模型明確分離。
- Sponsor / Binary 在UI語意明確分離。
- 第1與第3直推左子樹不由Frontend自行取代Backend檢核。
- Upgrade / Transfer / Exit使用正式Workflow API。
- Upgrade核准不由Frontend指定過去時間；預設讓Server取核准時間。
- Bonus、K0/K1/K2、EPV、RPV、Carry、Recovery不在Frontend自行計算。
- Return不提供刪除原交易操作。
- Payout以Qualification為單位的Backend結果為準。

## B. 與 Reviewed Backend API 一致性

已映射主要Admin API：
Person、Application、Qualification、Active、Product、Order、Payment、Organization、Subscription、
Ledger、Bonus、EPV、RPV、Global/Welfare、Return、Replay、Workflow、Payout。

限制：
Backend目前沒有完整Dashboard、Audit list、Application list、Qualification list、Order list、
Workflow list、Payout list等read-model/list APIs，因此v0.1.0不假造正式營運清單。

## C. Security

已做：
- UI Role Matrix
- Route-level UI guard
- Bearer API boundary
- Request ID

未完成：
- Backend Production Auth實際聯調
- Entra JWT驗證
- CSRF策略（若未來改Cookie session）
- MFA / dual approval UX
- 權限錯誤頁與session refresh

## D. UX

已做：
- Responsive desktop-first shell
- 高風險制度頁面清楚提示
- API result/error可直接查看，利於早期聯調
- 不使用假Dashboard營運數字

待做：
- Data Grid / search / pagination
- Detail drawers
- Form schema validation
- Confirmation dialogs
- Toasts
- Skeleton/loading
- Organization tree visualization

## E. Release 判定

**Admin MVP v0.1.0 = Foundation / Integration-ready UI scaffold**

不是 Production Release。
v0.2.0 應在Backend RC Gate通過後，接真實OpenAPI並完成：
- generated typed client
- 真實auth
- 正式Person/Application/Qualification/Order listing UX
- first end-to-end operational UAT
