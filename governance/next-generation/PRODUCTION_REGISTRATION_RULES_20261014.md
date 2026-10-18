# Production registration/password change — 2026-10-14

User requirement: phone OR email verification; password at least 6 characters including uppercase English, lowercase English and a digit. Special characters are not required. Existing 256-character maximum remains.

Changes:
- Registration and reset password rules enforced server-side, frontend input hints/patterns aligned; password login DTO and input allow 6 characters.
- Both registration screens explicitly explain phone or email verification is sufficient.
- SMS failure on registration suggests email fallback; provider diagnostics log only HTTP status or a bounded numeric error code, never credentials/recipient/message/OTP.

Verification:
- 20 frontend tests passed (web-registration-validation, web-member-entry, network-registration).
- 34 backend tests passed in isolated PostgreSQL (member-web-integration, sms-every8d, contact-verification), including actual six-character password registration/login/reset; invalid composition and short password rejection; proof consumption and replay restrictions; HTTP 403 rejection without retry.
- Test log: C:/UCell/logs/production-password-sms-20261014.log

SMS investigation (no test SMS sent):
- Same production Key Vault credentials: local GetCredit HTTP 200, 999.00 credits.
- Inside production API revision 0000002: GetCredit HTTP 403, server CloudFront, body Request blocked.
- Provider request ID: 7TFEetnOtff8vSHVSyNwFvt7nRaKefM2FixiL34MTovcAVSiv38kEg==
- Official API 2.1 documentation supports the existing +886 format and URL-encoded POST. No speculative destination rewrite made.
- Exact provider edge rule (source IP, region, WAF or other configuration) is unknown. Provider must inspect request ID and allow legitimate Azure production API traffic as appropriate. No claim of restored SMS delivery.

Supplier support draft (not sent):
Our Azure Container Apps production service in East Asia calls https://new.e8d.tw/API21/HTTP/GetCredit.ashx via HTTPS POST. On 2026-10-14 approximately 23:00 Asia/Taipei it received HTTP 403, CloudFront Request blocked; request ID above. Identical credentials from our local host receive HTTP 200 and 999.00 credits. Please identify the rejecting edge rule and advise the supported configuration for Azure production access, including whether a fixed outbound IP is required. No credentials are attached.

Deployment verification is recorded separately in C:/UCell/releases/production-20261014/registration-rules-deployment.json.
