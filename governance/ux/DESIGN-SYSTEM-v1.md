# UCell Design System v1 — UX-1

Baseline checkpoint: bce9296 (pushed before changes). Branch: integration/member-backend-mvp.

Architecture: shared/design-system private React peer package, consumed by file dependency in Member and Admin. Formal pnpm locks pin Bootstrap 5.3.3. Only Bootstrap Grid CSS is imported; no Bootstrap JavaScript, reboot, stock cards/buttons or icon framework. UCell semantic tokens and React components own the final appearance. Run pnpm install after changing the shared file package; restart Vite with --force when dependency optimization caches old source.

CSS layers: tokens.css → theme.css → typography.css → components.css → utilities.css. App adapters retain separate mobile Member and dense desktop Admin shells. Legacy styles remain for gradual migration; ucell-theme.css bridges them to shared tokens. No new page-specific colors.

Statuses preserve domain enums. ACTIVE/EFFECTIVE/PASS/RECOGNIZED/PAID success; PENDING/PENDING45D/PROCESSING/SCHEDULED/DUE/SUBMITTED warning; FAILED/SUSPENDED/EXCEPTION/REVERSED/CLAWBACK danger; CALCULATED/PAYABLE/INFORMATION info; DRAFT/INACTIVE/CANCELLED/CLOSED/VOIDED/EXITED and unknown values neutral. Text labels always accompany color. Tone denotes presentation only, never release approval or historical completion.

MoneyState formats server values only. Null pending is 結算中; finalized zero remains NT$ 0; absent unclassified money is 待提供. No sums, bonus formulas, eligibility, carry or lifecycle inference in design components. AwardLifecycle highlights only the explicit current state and disclaims completion of other stages.

Native dialog is used for accessible modal behavior plus explicit Tab containment; Escape and cancel return control to caller. ConfirmDialog requires reason and disables actions while busy. Actor/timestamp/audit and financial authorization remain Backend responsibilities: the component alone does not constitute a safe payout/replay workflow.

UX-1 is a first validated pattern, not completion of every requested feature. Tree Viewer, server-wide DataGrid pagination/export/saved views/bulk operations and complete pipeline evidence remain future additive integrations.

API changes: NONE. DB migration: NONE. Business logic changes: NONE. Production BLOCKED.

## UX-2 refinement

UX-2 adds semantic navy surfaces, restrained card hierarchy and a connected Chinese lifecycle timeline; only Backend current status is highlighted. See ux2/REPORT.md.
