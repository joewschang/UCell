# Engineering findings and preserved failures

1. Native dialog focus containment browser assertion failed on Tab cycling. Added explicit forward/reverse Tab wrap; subsequent browser checks pass. Tests were not weakened.
2. pnpm file dependency was retained in Vite optimized cache after shared component source changes. Refreshed isolated Vite servers and excluded @ucell/design-system from optimizeDeps to keep local TS component changes visible. Both apps retain React peer resolution; no duplicate UI framework introduced.
3. Full gate run intentionally stopped API/Worker before Prisma generate to avoid Windows DLL locking. End-of-run Admin HTTP/member local auth failed while services were stopped. Restarted API; member local auth passed. Admin full test then correctly rejected missing SALE_CONFIRMED historical evidence because Worker was still stopped. Restarted Worker, reran all 49 HTTP operations successfully. No evidence backfill or current-state fallback added. Previous failing runner logs remain in final/initial-attempts.
4. Default Windows python alias was unavailable for a source transformation. Used Node instead; no dependency or PATH change.
5. Admin bundle >500KB warning remains. This UX phase adds only Bootstrap Grid CSS and lightweight components. Route chunk splitting and remaining legacy style migration are staged; warning is not hidden.
6. Formal LINE/LIFF, Entra/RBAC and UAT remain unverified. Member screenshot harness is explicitly mock visual-only; real isolated DB Golden, Member contract/BOLA and Admin HTTP gates remain separate.

API changes NONE. DB migration NONE. Monetary/business logic changes NONE.

Windows CRLF normalization: a temporary diff --check with core.autocrlf=false treated existing carriage returns as trailing whitespace. The repository-default staged diff --check passed after normal Git normalization. No whitespace gate disabled or global Git config changed.
