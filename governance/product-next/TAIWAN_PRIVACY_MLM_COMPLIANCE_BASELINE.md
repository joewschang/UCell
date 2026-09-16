# UCell Taiwan Privacy / MLM Compliance Baseline
Status: VERIFIED DESIGN BASELINE; legal counsel review required before Production
Date: 2026-09-16
Scope: next-release Identity/KYC/Privacy architecture. Not legal advice and does not alter R1.0B economics.

## Verified regulatory facts
1. Taiwan Fair Trade Commission (FTC) requires multi-level marketing enterprises to establish and actually implement a personal-information-file security maintenance plan and post-business-termination handling measures. The FTC regulations require consideration of management personnel/resources, scope/audits, risk analysis/control, incident response and staff education/training.
2. Under the FTC MLM privacy regulations, a discovered personal-data leak must be reported to the FTC and affected persons notified appropriately; the current FTC text specifies a 72-hour reporting requirement.
3. MLM personal-data management procedures must identify ordinary vs special-category data, review specific collection/processing purposes, and determine notice obligations under Personal Data Protection Act Articles 8/9.
4. The FTC requires records/evidence of personal-data use, automatic equipment tracking data and other evidence needed to demonstrate implementation of protection measures; the plan must be reviewed/revised as business, technology or law changes.
5. FTC guidance states MLM collection/processing under the participation contract may have a contractual legal basis within the necessary MLM business purpose, but Article 8 notice obligations still apply; a separate written personal-data consent is not universally required merely because data is collected for the necessary MLM contractual purpose.
6. FTC inspection guidance expects MLM enterprises to maintain participant identity/contact and written participation-contract information, including name, national ID/business ID, address and contact phone, as part of inspection records.
7. The MLM Supervision Act requires pre-participation disclosure of specified business/plan/participant/withdrawal/product matters. Limited-capacity participant rules require written legal-representative consent and the statute states that specific consent cannot be an electronic document. This is a special case and must not be generalized to all adult electronic contracts.

## System consequences
### Data minimization and purpose registry
Create a `PrivacyPurposeVersion`/data inventory mapping every sensitive field to purpose, legal basis, notice version, retention class, roles, storage location and downstream processors. Do not collect fields merely because they might be useful later.

### Notice/contract evidence
ContractDocumentVersion and PrivacyNoticeVersion are separate versioned concepts even if rendered together. Preserve content hash/effective period and Person evidence of delivery/acknowledgment/consent where applicable. Formal-member onboarding must display required MLM disclosures before participation.

### Retention
Do NOT hardcode a universal retention period for ID images, bankbook images or all personal data. Assign retention classes and compute `retainUntil` from approved legal/operational policy. When purpose ceases or deletion/suspension is legally required, workflow must support deletion, suspension of processing/use, or lawful retention with reason. Destruction/transfer/deletion evidence must be retained where required.

### Security plan operations
Before Production maintain: data inventory, risk assessment, access-control matrix, staff training evidence, periodic audit, processor/vendor register, incident-response runbook, breach clock/evidence, backup/restore, access logs, deletion/destruction evidence, and plan revision history.

### Breach response
Implement security incident record with discoveredAt, severity, affected data/Persons, containment, regulatorNotificationDueAt, regulatorNotifiedAt, personNotification evidence, root cause and recurrence-prevention actions. Alert operational owners well before the 72-hour regulatory deadline; do not rely on manual memory.

### Sensitive documents
ID/bankbook objects private/encrypted; no public URLs; short-lived authorized access; explicit KYC_REVIEWER or approved role; access audit. Separate object bytes from relational metadata. Default Admin screens mask national ID/bank data.

### Minor/limited-capacity participation
Do not allow ordinary electronic flow to silently satisfy any statutory written legal-representative consent requirement. Age/capacity workflow must fail closed and route to an approved offline/written process if applicable. Product/legal must define supported eligibility before Production.

## Production legal checklist
- Confirm current filed MLM participation contract/disclosures match digital workflow.
- Confirm Privacy Notice specific purposes/categories/period/region/recipients/rights and Article 8 notice implementation.
- Confirm security maintenance plan is created/updated and submitted to FTC where required.
- Confirm retention schedule with counsel/accounting/tax/MLM obligations; do not guess one global number.
- Confirm KYC document necessity and whether both ID sides are actually needed.
- Confirm bank-data purpose and verification procedure.
- Confirm vendor DP/security terms for SMS, object storage, identity provider and analytics processors.
- Confirm incident response owner and 72-hour regulator workflow.
- Confirm minor/limited-capacity participant policy.

## Sources checked 2026-09-16
- Taiwan Fair Trade Commission, Regulations Governing Multi-level Marketing Enterprises for setting up the Plan of Security Measures for Personal Information Files and post-termination processing measures (FTC current published regulations).
- Taiwan Fair Trade Commission, MLM personal-data FAQ regarding Personal Data Protection Act Articles 8, 19 and 20.
- Taiwan Fair Trade Commission, Multi-Level Marketing Supervision Act and current MLM case-handling/inspection guidance.

External legal review remains required before Production because exact retention periods and document necessity depend on the approved business/legal basis and other applicable recordkeeping obligations.