# R1.0B Operational Closure Cross-Layer Impact Matrix

## Change header

- **Change ID:** R1_0B_OPERATIONAL_CLOSURE_20260925
- **Title:** R1.0B operational closure: Paper Order/Receipt, Company Sponsor Alias, onboarding and Retail Referral gaps
- **Request / decision:** Product Owner approved Paper Order/Receipt/Company Sponsor decision and Operational Closure continuation
- **Requested by:** Product Owner
- **Date:** 2026-09-25 (Asia/Taipei)
- **Baseline branch:** `integration/member-backend-mvp`
- **START_HEAD:** `488995715854ec2780c850d33bf1097b6516eef8`
- **Business decision / SSOT refs:** R1.0B onboarding spec; approved Paper Order/Receipt/Company Sponsor decision; P0 privacy decision; Cross-Layer Governance Rule v1
- **Affected domains:** identity, membership, commerce, payments, organization, ledger, admin, member, OpenAPI, governance
- **Risk class:** HIGH
- **Effective date / as-of:** deployment/configuration determined; historical facts remain evidence-bound
- **Deployment scope:** NONE
- **Rollback or forward-fix policy:** forward-only migrations; append-only economic/recovery evidence; no historical migration edits

## Nine-layer impact matrix

| Layer | Status | Affected artifacts | Required action | Evidence / commit | Owner / reason if deferred |
|---|---|---|---|---|---|
| 1. Business /制度 Definition | UPDATED | Approved Paper/Receipt/Company Alias decision; re-audit | Use approved source/channel, receipt and alias semantics only | This matrix and re-audit | — |
| 2. Semantic & Governance Core | UPDATED | Semantic Golden catalog | Record theory/payable/recovery and paper/alias invariants; no physical semantic mapping | Pending current worktree | — |
| 3. AI Brain Core | UPDATED | Future AI design impact | Define safe terminology/evidence boundaries; AI runtime remains absent | This matrix | — |
| 4. API / OpenAPI | DEFERRED_WITH_OWNER_AND_REASON | Paper, alias, receipt, explain contracts | Implement then regenerate/validate/diff OpenAPI | Backend closure owner; runtime slice not yet implemented | Engineering owner: R1.0B closure |
| 5. DB / Migration / Data Dictionary | DEFERRED_WITH_OWNER_AND_REASON | Receipt/alias persistence and dictionary | Forward-only schema after concrete design; fresh migration and DB Golden required | No schema inferred before design | Engineering owner: R1.0B closure |
| 6. Runtime Code | DEFERRED_WITH_OWNER_AND_REASON | Backend/Worker/Admin/Member | Implement paper/alias and remaining retail/onboarding vertical slices | Re-audit identifies open work | Engineering owner: R1.0B closure |
| 7. Tests / Golden / Security | UPDATED | Retail DB rollback integration and semantic golden catalog | Preserve existing active/inactive/return invariants; add remaining required gates | `4889957` baseline test evidence | — |
| 8. GitHub Technical SSOT | UPDATED | Gap audit, impact matrix, semantic catalog | Keep closure reports, data dictionary and status synchronized | Pending current worktree | — |
| 9. Google Drive Formal Documents | DEFERRED_WITH_OWNER_AND_REASON | Four named UCell V4.0 formal docs | No Drive tool authorization in this task; assess exact changes at final closure | Owner: Product/Documentation; Drive sync pending | Explicit tooling/authorization required |

## Semantic impact

- **Facts:** `RETAIL_ATTRIBUTION_EFFECTIVE`, `PAYMENT_CONFIRMED`, `PLACEMENT_COMMITTED`, `QUALIFICATION_ACTIVATED`, `AWARD_RECOGNIZED`, `RECOVERY_RECOGNIZED`.
- **Rules:** Retail theory, eligibility and payable are separate evidence; paper source is provenance, not an economic engine; Company alias is qualification-only and not a retail referrer.
- **Privacy:** Alias and future AI/read models must not disclose Bootstrap topology, Reservoir or unauthorized PII.
- **Historical/as-of:** SKU, Active eligibility, Sponsor/alias and Award facts must remain snapshot/evidence bound.
- **Certification:** Physical semantic mappings are not certified; SG-A1 is explicitly out of scope.

## AI Brain impact

- **AI runtime:** `NOT_IMPLEMENTED`.
- **Definition impact:** `UPDATED` for Paper Order terminology, Company Sponsor Alias safe label, Retail Referral theory/eligibility/payable/recovery, Existing Member LINE Link and Placement Pending.
- Future tools may only use approved evidence and must not infer hidden Company topology, Reservoir data or PII.

## Google Drive assessment

| Formal document | Status | Required future change |
|---|---|---|
| UCell_V4_0_制度與獎金海報文案_正式版.docx | DEFERRED_WITH_OWNER_AND_REASON | Add only approved public wording for paper onboarding and retail referral after runtime closure. |
| UCell_V4_0_制度與獎金計算說明手冊_正式版.docx | DEFERRED_WITH_OWNER_AND_REASON | Explain Retail Referral theory/payable/recovery and Company Alias safe-display boundary. |
| UCell_V4_0_創始合夥人招募計畫_正式版.docx | VERIFIED_NO_CHANGE | No recruitment-plan change is authorized by this runtime closure. |
| UCell_V4_0_獎金引擎與資料庫規格書_正式版.docx | DEFERRED_WITH_OWNER_AND_REASON | Add approved Paper provenance/receipt and Retail Referral evidence details after DB/API finalization. |

## Current closure status

`PARTIAL` — no deployment performed. Google Drive remains pending, so this change cannot be `FULLY_SYNCHRONIZED`.
