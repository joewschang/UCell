# UCell V1.1–V1.3 Implementation Readiness Matrix
Status: CONTROL BASELINE
Date: 2026-09-17

## Status vocabulary
READY_AFTER_GATE0 = design/decision sufficient; coding may begin after current R1.0B Gate 0 approval.
CONFIG_PENDING = engineering can proceed but Production requires external/provider/environment configuration.
LEGAL_PENDING = affected Production path requires verified legal/retention/notice policy.
DATA_CALIBRATION = implementation can proceed with versioned defaults; management use requires real-data calibration.
FEATURE_DISABLED = architecture retained but feature intentionally disabled for current LINE OA release.
POST_MVP = deliberately outside current next-release scope.

## Authentication channel baseline
Current LINE OA/LIFF: LINE_LOGIN=ENABLED. SMS_OTP_LOGIN=DISABLED_CURRENT. GOOGLE_OIDC_LOGIN=DISABLED_CURRENT. SMS/Google remain future Web/App capabilities and do not block current LINE OA V1.1/V1.2. Mobile/email remain contact fields unless a future verification policy explicitly enables step-up verification.

## Matrix
| Epic | Version | Design | Core decision | External blocker | Readiness | Production condition |
|---|---|---|---|---|---|---|
| LINE OA network registration | V1.1 | Complete | LINE-first auth approved | formal LINE/LIFF config | CONFIG_PENDING | real LINE credentials + privacy notice + UAT |
| Contract consent/versioning | V1.1 | Complete | approved architecture | final contract/privacy text | LEGAL_PENDING | approved document versions |
| SMS OTP login | Future Web/App | Complete architecture | security baseline approved | intentionally disabled | FEATURE_DISABLED | future channel decision + provider |
| Google OIDC login | Future Web/App | Complete architecture | provider model approved | intentionally disabled | FEATURE_DISABLED | future OAuth client/channel enablement |
| Delivery profile | V1.1 | Complete | approved boundary | privacy notice | READY_AFTER_GATE0 | security/UAT |
| Formal member application | V1.1 | Complete | workflow approved; no SMS OTP required by current channel | legal/KYC SOP | LEGAL_PENDING | approved onboarding policy |
| KYC documents | V1.1 | Complete | minimization/private storage approved | exact required docs/retention | LEGAL_PENDING | retention + document SOP |
| Bank identity | V1.1 | Complete | manual MVP policy approved | bank master/SOP | CONFIG_PENDING | master source + reviewer SOP |
| Admin KYC review | V1.1 | Complete | RBAC baseline approved | Entra role mapping/SOP | CONFIG_PENDING | formal RBAC + audit/UAT |
| Referral attribution | V1.2 | Complete | 30-day rule approved | none material | READY_AFTER_GATE0 | UAT/concurrency |
| LINE OA/LIFF referral bridge | V1.2 | Complete | signed-state + LINE auth boundary approved | LINE credentials/config | CONFIG_PENDING | real LIFF/UAT |
| System assignment | V1.2 | Complete | pool/load-balance/BFS approved | actual system-ball pool configuration | CONFIG_PENDING | approved pool entries + concurrency UAT |
| CMS/content/share | V1.2 | Complete | boundary approved | media storage/config | READY_AFTER_GATE0 | storage/security/UAT |
| Activities/free registration | V1.2 | Complete | free-only boundary approved | none material | READY_AFTER_GATE0 | capacity/concurrency UAT |
| Paid activities | Future | intentionally excluded | separate rules absent | payment/refund policy | POST_MVP | separate project |
| Member inbox | V1.2 | Complete | canonical inbox approved | none material | READY_AFTER_GATE0 | audience/RBAC/UAT |
| LINE push | Future adapter | architecture approved | canonical inbox approved | LINE Messaging credentials/opt-out policy | POST_MVP | channel governance |
| AnalyticsEvent foundation | V1.1/V1.2 seam | Complete | privacy/event rules approved | none material | READY_AFTER_GATE0 | projection/idempotency tests |
| Analytics projector | V1.3 | Complete | freshness baseline approved | Azure sizing | READY_AFTER_GATE0 | workload/freshness UAT |
| NASL current/transitions/cohort | V1.3 | Complete | 30/90 + event principle approved | event-set configuration/calibration | DATA_CALIBRATION | real-data calibration |
| Sponsor Sonar 1–12 | V1.3 | Complete | tree separation approved | thresholds calibration | DATA_CALIBRATION | reconciliation/performance |
| Binary Sonar 1–12 | V1.3 | Complete | tree separation approved | thresholds calibration | DATA_CALIBRATION | Core volume/carry reconciliation |
| Heat labels | V1.3 | Complete | initial thresholds approved | real-data calibration | DATA_CALIBRATION | policy review after UAT data |
| Organization Health | V1.3 | Complete | weights approved | normalization calibration | DATA_CALIBRATION | explainability/review |
| Referral/content/activity/message funnels | V1.3 | Complete | attribution semantics approved | sufficient event history | DATA_CALIBRATION | source reconciliation |
| Analytics export | V1.3 | Complete | permission/minimization approved | retention/export owner | CONFIG_PENDING | export policy + audit |
| Daily operations brief | V1.3 | Complete concept | analytics-only approved | sufficient projections | DATA_CALIBRATION | freshness/quality gates |

## Gate 0 dependency
Every READY_AFTER_GATE0/CONFIG_PENDING/LEGAL_PENDING/DATA_CALIBRATION item remains non-implementing until current R1.0B Core Closure checkpoint is formally approved and a next-release branch is cut from a verified integration commit, except separately reviewed non-invasive event seams. FEATURE_DISABLED capabilities do not participate in current release gates.

## Cross-cutting implementation dependencies
Schema owner designated before migrations. Azure UAT private object storage/Key Vault/PostgreSQL/Container Apps available before KYC/media UAT. Formal LINE credentials stay outside repo. Google/SMS credentials are not required for current LINE OA track. Entra RBAC mapping required before Admin KYC Production. Analytics source events start early enough to build history. No next-release role grants new monetary mutation rights.

## Production release blockers by domain
Identity current LINE OA: formal LINE/LIFF credentials/config, privacy/contract versions, KYC legal/SOP, bank master, Entra roles. SMS/Google are explicitly excluded from current LINE OA blockers.
Growth: LINE config for LIFF path, actual SystemAssignmentPool, media storage/security.
Analytics: sufficient history, policy calibration, projection workload/freshness, export governance.
Global: Security E2E, backup/restore, UAT, monitoring, incident runbook, Production Go/No-Go.

## Rule
`code complete` is not `Production ready`. Each feature reports both engineering status and operational/legal/configuration status.