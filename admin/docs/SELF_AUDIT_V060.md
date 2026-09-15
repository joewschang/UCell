# Admin MVP v0.6.0 Self Audit

## Authentication
PASS by static review:
- Entra uses MSAL.
- Browser does not keep Entra token as UCell credential.
- Backend opaque session is stored in sessionStorage.
- 401 clears the session.
- Demo login is blocked in production build.

Backend companion:
- Validates Entra signature/issuer/audience/tenant.
- Requires explicit AdminAccessGrant.
- Backend session is short-lived/configurable.
- Logout revokes session.

## Authorization
Backend R6:
- Global authentication guard.
- Global role guard.
- Missing role policy fails closed.
- Sensitive payout logic retains service-level role checks and different-actor dual approval.

## UAT
30 scenarios defined.
UAT Console provides execution/evidence assistance.
Formal CSV UAT Gate remains intentionally NOT PASS until humans execute the tests in a live environment.

## Release safety
Static/Offline gates can pass here.
Dependency/DB/Security/UAT/Backup gates cannot be truthfully declared PASS in this environment and remain release blockers.

## Verdict
**Admin v0.6.0 = Release Preparation Complete / Awaiting live DEV/CI + UAT.**

## Browser hardening
- Apache/cPanel security-header baseline included.
- CSP permits Microsoft login endpoints and blocks framing/object content.
- Production deployment must reproduce equivalent headers if hosting changes.
