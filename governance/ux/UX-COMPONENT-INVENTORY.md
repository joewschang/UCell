# Component inventory

| Layer | Implemented components | Adoption |
|---|---|---|
| Shared | StatusBadge, MetricCard, MoneyState, SectionHeader, EmptyState, ErrorState, LoadingState, Skeleton, ConfirmDialog, DetailDrawer, PageHeader, FilterBar, QualificationBadge, PeriodBadge, UCellButton, AwardLifecycle | Member priority pages; Admin metrics/drawers |
| Member | MemberAppShell, QualificationSwitcher, MemberBottomNav, MobileMetricCard, MobileActionGrid, MemberSection, MemberStatusCard | Shell, switcher, navigation, actions adopted; remaining adapters available for staged pages |
| Admin | AdminAppShell, AdminSidebar, AdminHeader, AdminPageHeader, AdminFilterBar, AdminMetricCard, AdminDetailDrawer, AdminCommandBar, AdminAlertPanel | Shell/sidebar/header, metrics and drawers adopted; other adapters available |
| Admin consumer | AdminDataGrid | Person bounded result sort/column chooser/pagination; server search remains page-owned |

Remaining: full DataGrid saved view/export/authorized bulk, complete Qualification tabs, Tree Viewer authoritative nodes, pipeline stage metadata, gradual legacy style/component migration. Components without page adoption are not claimed as complete workflows.

## UX-2 refinement

UX-2 refines AwardLifecycle, DetailDrawer focus trap, AdminAppShell and AdminDataGrid toolbar; adds QualificationDetail (ten tabs) and read-only PipelineDetail. Shared tokens remain authoritative; no new UI framework.

## UX-3 freeze and rollout

UX-3 adds MemberPageHeader, AdminTable bounded-grid adapter and ConfirmAction. AdminDataGrid now supports loaded-page search and row detail while disclosing scope.
