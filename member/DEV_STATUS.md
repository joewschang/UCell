# UCell Member MVP Development Status

Checkpoint: v0.2 / 2026-09-15
Branch: `feature/member-liff-mvp`

Completed:
- React + TypeScript + Vite LIFF application shell
- LINE LIFF bootstrap with mock fallback
- Mock/Real API boundary
- Person -> 1:N Qualification context provider
- Independent Qualification/Ball selector persisted in sessionStorage
- Routed Home / Organization / Performance / Bonuses / Shop / Orders / Me screens
- Dashboard PV/RPV/EPV and pending-award semantics
- Sponsor Tree / Binary Tree separation explicitly preserved in UX/API contract
- Member API authorization contract: fail closed for Person-Qualification ownership
- Official monetary values remain backend-owned; no frontend award calculation

Next:
- Implement organization Sponsor/Binary DTO views
- Implement performance period cards
- Implement award lifecycle/ledger view
- Implement product/order DTOs
- Connect LIFF ID and backend session exchange
- Add member BOLA/IDOR integration tests
- Add responsive/UAT acceptance scenarios

Release status: DEVELOPMENT ONLY. Not Production-PASS.
