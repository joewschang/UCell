# G8 high-risk audit coverage matrix

This matrix maps the Phase 1 required audit domains to implemented authoritative events. Event payloads use safe references, hashes and changed-field names; the AuditService redacts restricted values.

| Required operation | Event evidence | Status |
|---|---|---|
| Person/member creation and sensitive identity change | `PERSON_CREATED`, `PAPER_NEW_PERSON_CREATED`, `MEMBER_PROFILE_UPDATED`, Paper duplicate review events | IMPLEMENTED |
| Paper Application and identity review | `PAPER_APPLICATION_CREATED`, `PAPER_IDENTITY_CHECKED`, `PAPER_DUPLICATE_REVIEW_*` | IMPLEMENTED |
| Paper receipt/payment | `PAPER_RECEIPT_*`, `PACKAGE_PAYMENT_CONFIRMED`, `PAYMENT_CONFIRMED` | IMPLEMENTED; Stage exercise pending |
| Qualification state change/placement | `MEMBERSHIP_APPLICATION_APPROVED_EFFECTIVE`, `QUALIFICATION_PLACED`, `TREE_QUALIFICATION_PLACED` | IMPLEMENTED |
| LINE link/rebind/recovery | `EXISTING_MEMBER_LINE_LINK_*`, `LINE_BINDING_CREATED`, `LINE_REBIND_*`, `LINE_BINDING_REVOKED` | IMPLEMENTED; formal credential exercise pending |
| Order/return/refund | `ORDER_CREATED_CONFIRMED`, `WEB_MEMBER_RETAIL_*`, `RETURN_POSTED` | IMPLEMENTED |
| Retail attribution correction | `RETAIL_REFERRER_ATTRIBUTION_CORRECTED_FORWARD` plus immutable attribution history | IMPLEMENTED |
| Award/recovery/settlement/payout operations | `PAYOUT_APPROVED`, `PAYOUT_EXPORTED`, `PAYOUT_PAID`; append-only domain evidence | IMPLEMENTED |
| Company sponsor alias | `COMPANY_SPONSOR_ALIAS_CREATED` | IMPLEMENTED |
| Security login/denied access/role change | `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `LOGOUT`, session/link/rebind and HTTP outcome evidence exist; Admin and Member BOLA access-denied exist; role-change coverage remains incomplete | PARTIAL |
| Restricted read/export | `PERIOD_EXPORT_REQUESTED`, `PERIOD_EXPORT_DOWNLOADED`, structured explain reads | IMPLEMENTED |

The remaining partial row is tracked as `SECURITY_EVENT_AUDIT`; it must not be marked complete until explicit login/access-denied/role-change event evidence is added and verified.
