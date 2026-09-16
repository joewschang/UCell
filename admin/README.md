# UCell Admin MVP v0.6.0 — UAT + Security Convergence / Release Preparation

登入後 Dashboard 已納入 **Midnight Current 營運指揮中心**設計，與會員首頁
**Luminous Midnight** 一併成為[開發介面基線](../UI_DESIGN_BASELINE.md)。
以下原版本功能說明保留；視覺採用不代表正式登入／上線驗證已完成。

制度：R1.0B FROZEN  
Backend companion：Reviewed v0.6.10-R6 UAT/Security/ReleasePrep  
Frontend：Admin MVP v0.6.0

## 本版重點

### Microsoft Entra Production Login
- Browser使用MSAL取得Microsoft ID Token。
- ID Token只送到Backend做交換。
- Backend驗證JWKS簽章、issuer、audience、tenant。
- 只有存在ACTIVE AdminAccessGrant的Entra Object ID可以登入。
- Backend簽發1小時短效Opaque Session。
- Admin UI只保存Backend Session於sessionStorage。
- Logout會撤銷Backend Session。
- 401會自動清除本地Session。

### Backend RBAC
R6後 `/admin/*` 同時經過：
1. AdminAuthenticationGuard
2. AdminRoleGuard

AdminRoleGuard採fail-closed：
任何Admin Controller若沒有Roles policy → `ROLE_POLICY_MISSING`，不是默認放行。

### UAT
Admin新增UAT Console，內含30組R6案例：
- 21組P0
- 9組P1
- 可記錄PASS/FAIL/BLOCKED、Tester與Evidence/Correlation ID
- 可匯出Evidence JSON
- 正式Release Gate仍以簽核後 `UAT_EXECUTION_R6.csv` 為準

### Release Preparation
Backend附：
- Security Threat Matrix
- UAT Matrix / Execution Template
- Production Environment Checklist
- Cutover Runbook
- Rollback Runbook
- Admin Bootstrap
- Security HTTP E2E Runner
- UAT Gate
- R6 Release Gate JSON

## 還不能宣稱Production Ready
本環境無網路/無pnpm/PostgreSQL，因此以下仍必須在真正DEV/CI執行：
- dependency install
- Prisma validate/generate
- TypeScript build
- migration deploy
- DB Golden E2E
- live Entra login
- Security E2E
- P0/P1 UAT
- backup/restore drill
- RC Gate
