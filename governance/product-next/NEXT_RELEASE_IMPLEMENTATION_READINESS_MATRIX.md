# UCell V1.1–V1.3 Implementation Readiness Matrix
Status: CONTROL BASELINE
Date: 2026-09-17

Statuses: READY_AFTER_GATE0; CONFIG_PENDING; LEGAL_PENDING; DATA_CALIBRATION; FEATURE_DISABLED; POST_MVP.
Current auth: LINE enabled; SMS OTP/Google future Web/App.

## Member / Qualification / Growth
| Capability | Readiness | Production condition |
|---|---|---|
| LINE OA registration | CONFIG_PENDING | real LINE/LIFF + privacy/UAT |
| Contract/privacy consent | LEGAL_PENDING | approved versions |
| Formal application/KYC | LEGAL_PENDING | exact docs/retention/SOP |
| Bank identity | CONFIG_PENDING | bank master/reviewer SOP |
| Package Management | READY_AFTER_GATE0 | Admin RBAC/version migration/UAT |
| Member Product Picker | READY_AFTER_GATE0 | package/product seed + checkout UAT |
| 啟航/菁英/領袖 qualification purchase | READY_AFTER_GATE0 | recognition config + payment + KYC/contract gates |
| 季/半年/年活躍 | READY_AFTER_GATE0 | Active-policy entitlement semantics + recognition config |
| Ball Sponsor setup/manual change | READY_AFTER_GATE0 | Sponsor eligibility/cycle tests |
| Sponsor-owner Binary placement | READY_AFTER_GATE0 | placement RBAC/concurrency/UAT |
| 72h Placement Monitor/Admin override | READY_AFTER_GATE0 | Admin permission/operational owner |
| System auto no-referral | CONFIG_PENDING | approved SystemAssignmentPool entries |
| Referral 30d / LIFF bridge | CONFIG_PENDING | LINE real UAT; attribution logic ready |
| CMS/Activities/Inbox | READY_AFTER_GATE0 | storage/RBAC/UAT as applicable |

## Commerce / Fulfillment
| Capability | Design | Readiness | Production condition |
|---|---|---|---|
| Payment Hub canonical model | Complete | READY_AFTER_GATE0 | security/idempotency/reconciliation |
| Taishin online card | Contract ready | CONFIG_PENDING | merchant API docs/credentials/sandbox-prod callback UAT |
| Taishin physical POS evidence | Contract ready | CONFIG_PENDING | terminal/batch SOP + reconciliation |
| ECPay payment | Adapter planned | CONFIG_PENDING | merchant credentials/API UAT |
| LINE Pay | Adapter planned | CONFIG_PENDING | merchant/channel credentials/API UAT |
| Inventory Lite | Complete design | READY_AFTER_GATE0 | initial stock import/count + concurrency UAT |
| Lot/Serial trace | Complete design | READY_AFTER_GATE0 | SKU tracking policy + barcode/serial format/warehouse devices |
| Picking/packing | Complete design | READY_AFTER_GATE0 | warehouse SOP/device UAT |
| QC | Complete design | READY_AFTER_GATE0 | QC checklist/policy + operator training |
| Black Cat logistics | Adapter planned | CONFIG_PENDING | contract/API credentials/label-tracking UAT |
| 7-ELEVEN pickup | Adapter planned | CONFIG_PENDING | direct/aggregator route + store-map/label/tracking UAT |
| Invoice Hub | Complete design | READY_AFTER_GATE0 | invoice policy/accounting SOP |
| ECPay e-invoice | Adapter planned | CONFIG_PENDING | e-invoice service credentials + issue/void/allowance UAT |
| Other invoice provider | Adapter-ready | POST_MVP | provider selection |
| Return/RMA | Complete design | READY_AFTER_GATE0 | return SOP + Core POSTED/replay integration UAT |
| ERP Gateway | Complete design | READY_AFTER_GATE0 | outbox/reconciliation tests |
| Dynamics 365 BC adapter | Contract-ready | POST_MVP/CONFIG_PENDING | BC environment/API/auth/mapping/cutover project |
| ERP-less operations | Complete design | READY_AFTER_GATE0 | backup/restore + daily stock/payment reconciliation |

## Analytics
AnalyticsEvent/projector READY_AFTER_GATE0. NASL/Sonar/Health/funnels DATA_CALIBRATION. Analytics export CONFIG_PENDING on retention/export governance. Add package sales/product-selection, payment exception, fulfillment aging, QC fail, shipment SLA, RMA and reconciliation dashboards after source events stabilize.

## Critical path for first operational launch without BC
1 Gate 0/branch/schema ownership.
2 LINE real LIFF + contracts/KYC operational readiness.
3 Package Management/Product Picker + qualifying purchase/Ball setup.
4 Taishin online payment production integration.
5 Inventory Lite + initial stock + Pick/Serial/QC.
6 At least one shipping path (recommended home delivery first if provider ready), then 7-ELEVEN pickup.
7 E-invoice provider production integration.
8 Return/RMA + payment/invoice reversal path.
9 Security E2E, backup/restore, reconciliation, monitoring, UAT and Go/No-Go.

## Provider credentials rule
No provider credential or secret in GitHub/docs. Store in Azure Key Vault/environment secret management. DEV mock PASS != provider UAT != Production ready.

## BC cutover rule
ERP-less UCell is valid operational mode. BC is introduced by domain-specific SoR cutover after mapping/reconciliation. No big-bang rewrite and no synchronous dual-write assumption.

## Rule
`code complete` != `Production ready`; report engineering, provider/config, legal/operational and data-calibration status separately.