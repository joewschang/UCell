# Admin MVP v0.4.0 Self Audit

## A. Return correctness
PASS:
- 原Order/PV/Award不提供Delete操作。
- Return只建立反向事件。
- R4 Backend改用正式SettlementCalendar計算退貨經濟週。
- Recovery outstanding balance正確初始化。
- Recovery重複建立有service + DB兩層防護。
- Replay只顯示Backend實際period/K差異。

## B. Workflow correctness
PASS:
- NT$600不再由UI默認為已付款，必須人工勾選確認。
- Upgrade不得以Frontend指定過去effectiveAt。
- Transfer / Company Retransfer使用Receiving Person。
- Exit明確要求Company Holder。
- 轉讓對價不由公司系統管理。
- Qualification身份與組織位置不因Transfer重新建立。

## C. Payout correctness
PASS:
- Payable先Materialize，再建立Batch。
- Gross - Recovery = Net由Backend完成。
- 每Qualification獨立PayoutLine。
- Finance + Compliance兩階段核准。
- R4 Backend要求兩個不同Actor。
- 未雙核准不得Export。
- 未Export不得Mark PAID。
- Mark PAID會同步PayableEntry。
- 外部Payment Reference留下Audit。
- 不宣稱UCell Core直接操作銀行轉帳。

## D. Security
Improved:
- Payout Service對Finance/Compliance stage有Role檢核。
- 雙核准要求不同Actor。

Still pending:
- Production AuthenticationGuard / AdminRoleGuard在所有Controller的一致套用。
- Entra token驗證。
- MFA / session hardening。
- BOLA / IDOR / privilege escalation security tests。

## E. Release Verdict
**Admin v0.4.0 = Return/Workflow/Payout Operations Complete / Integration-ready / Pre-Production.**

不是Production Release；Backend dependency/DB RC Gate仍是硬門檻。
