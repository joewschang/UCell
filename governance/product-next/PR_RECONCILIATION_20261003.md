# PR 21 / 23 / 24 reconciliation

The Product Owner requested resolution of duplicated work on 2026-10-03. PR 23 is the canonical integration branch based on verified Stage integration PR 22.

- PR 24 commit f5b82367521755fe98689e5e88f178c55d85a9df: adopt its five Admin/design-system files, replacing the later local AppShell shortcut with the single longest-route selector. Retain PR 23's component regression test. Preserve its eight matching icons, sidebar styling and detail-page selection behavior. No second menu fix remains active.
- PR 21 commit a660f19d437c2208750c0754dbf953c9800e1798: preserve qualification-inactivity.ts verbatim and extract its eight original domain cases into r11-inactivity-test.mjs, executed by CI. This is a pure evaluator; it does not transfer ownership, send notifications or enable recovery execution.
- Do not import PR 21's Geo schema/migration, profile service, reducers or normalization files. PR 23 already supplies the deployed authoritative Geo implementation. Both DDLs create organization.geo_admin_area, and their member-profile schemas differ. The deployed migration 20261003100000_organization_geo_foundation remains unchanged; no duplicate migration is introduced.

PRs 21 and 24 are superseded by reconciliation in PR 23, not independently merged. Their source branches and commits remain available. Issue 5–11 acceptance gates, inactivity persistence/worker execution, approved Production documents, formal Entra UAT and OpenAPI baseline authority remain pending.
