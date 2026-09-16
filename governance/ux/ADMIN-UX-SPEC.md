# Admin UX-1

Operations-first desktop references 1366/1440/1920 and 768 tablet. Admin shares tokens with Member, retaining distinct sidebar/content shell and role-filtered routes. DEV actor input, cache clearing, bearer handling and authorization boundaries remain unchanged.

Dashboard: real Core counts retained. Static green reviewed/release claims removed. GMV/New/Suspend/Lost/imbalance/security/pipeline metadata unavailable in dashboard API is explicitly pending, never synthesized.

Person: bounded server search result uses AdminDataGrid; sort/column selection/pagination operate on loaded rows and disclose that the result is not a complete registry. Identity detail uses native read-only drawer. Person read API lacks LINE/KYC and an exact owned-qualification list. Mark unavailable and link actual Qualification module; do not infer ownership from name matches.

Qualification module retains existing holder, Sponsor, Binary, Active timeline, orders and PV ledger. Person and Qualification data stay separate. Requested full multi-tab detail migration remains staged.

Bonus/Settlement: pipeline legend is not an execution result; every unsupported stage status says pending. Existing authoritative settlement/pool/qualification compensation reads remain. Award details move into keyboard-accessible drawer; append-only lifecycle/recovery facts remain read only.

DataGrid server pagination, saved views, exports and authorized bulk commands are pending. No generic frontend bulk monetary mutation is introduced. Existing high-risk workflows are preserved rather than replaced with weaker confirmations.

Sidebar is grouped into Dashboard, 會員管理, 組織管理, 商務, 獎金中心, 財務, 營運分析, 系統治理; every original route occurs once and role filtering is unchanged. Person creation is a collapsible labeled form so the operational registry is visible sooner. Loading is distinct from empty data.

## UX-2 refinement

UX-2: collapsible domain groups, unavailable Operations sections, exact owned-Qualification drawer with ten tabs, exact-batch read-only pipeline, shared grid toolbar. Proposed aggregate sources: ux2/READ-MODEL-API-PLAN.md.

## UX-3 freeze and rollout

UX-3 applies the enterprise shell and approved grids/states/confirmation patterns to all 18 protected Admin routes. Missing read models remain unavailable.
