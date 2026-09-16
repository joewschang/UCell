# UX-3 route rollout matrix

| Product | Routes | Applied pattern |
|---|---|---|
| Member | `/`, `/organization`, `/performance`, `/bonuses` | Approved UX-2 hierarchy, trees kept separate, nullable money and current-only lifecycle |
| Member | `/shop`, `/orders`, `/notifications`, `/me` | Member page header, Qualification context, token cards/forms, shared loading/empty/error; existing idempotent mutations preserved |
| Admin | `/`, `/people`, `/qualifications`, `/bonuses` | Approved UX-2 dashboard, master-detail and pipeline |
| Admin | `/applications`, `/applications/new`, `/organization`, `/subscriptions` | Shared header/status/state/surfaces; existing route/RBAC; organization domains remain separate |
| Admin | `/products`, `/orders`, `/returns`, `/workflows` | Unified bounded grids and governed high-risk confirmations; existing commands unchanged |
| Admin | `/payouts`, `/documents`, `/reports`, `/audit`, `/system`, `/uat` | Enterprise density, bounded grids, detail patterns and unavailable evidence semantics |

Responsive coverage is four widths per route: Member 375/390/430/768; Admin 768/1366/1440/1920. `references/results.json` contains 104 route/viewport assertions and 26 reference screenshots. Member references are explicit mock visual fixtures only; Admin references are isolated Connected DEV reads. Formal credentials are not certified by screenshots.
