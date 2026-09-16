# UCell Next Release — System Ball / Reservoir Engineering Delta
Status: APPROVED DESIGN INTEGRATION DELTA
Date: 2026-09-16
Applies to future next-release Core implementation after Gate 0.

## Purpose
Integrate approved System Ball + Reservoir A/B rules into Data Model, Event Catalog, API, RBAC, Backlog, Replay and Sprint contracts without modifying current R1.0B implementation during Core Closure.

## 1. Data-model delta
Add QualificationOwnershipHistory as authoritative effective-dated ownership history: id, qualificationId, ownerType SYSTEM|PERSON, ownerPersonId?, sourceReason FOUNDATION|MEMBER_EXIT_RECLAIM|SPECIAL_PLACEMENT|MEMBER_ASSIGNED|ADMINISTRATIVE_CORRECTION, effectiveFrom, effectiveTo?, policyVersion?, approvalRef?, correlationId, createdAt. Enforce one effective owner at a time.

Add SystemAssignmentPoolEntry: id, qualificationId, policyVersion, enabledFrom, enabledTo?, priorityClass, capacityLimit?, status, approvalRef. Pool membership is not ownership truth.

Add CompanyReservoir(code A|B, displayName, status, createdAt). Add CompanyReservoirLedger(id,reservoirCode,entryType CREDIT|DEBIT|REVERSAL|ADJUSTMENT|TRANSFER,amount,currency,sourceType,sourceId,earningQualificationId?,periodId?,bonusType?,reasonCode,ruleVersion?,parameterHash?,calendarVersion?,replayRunId?,transferId?,correlationId,approvedBy?,occurredAt,createdAt,metadataHash). Balance is derived.

Add ReservoirApprovalEvidence(id,actionType,reservoirCode,amount,requesterId,approverId?,reasonCode,purposeRef?,requestedAt,approvedAt?,status,correlationId,evidenceHash).

Extend BonusCalculationEvidence with destinationType MEMBER|RESERVOIR_A|RESERVOIR_B, destinationReasonCode and destinationReferenceId where compatible; do not rewrite current historical evidence.

## 2. Event catalog delta
SYSTEM_BALL_FOUNDATION_CREATED
QUALIFICATION_RECLAIMED_TO_SYSTEM
SYSTEM_BALL_ASSIGNED_TO_PERSON
SYSTEM_BALL_SPECIAL_DESIGNATED
SYSTEM_ASSIGNMENT_POOL_ENABLED/DISABLED
SYSTEM_ACTIVE_OVERRIDE_APPLIED
RESERVOIR_A_CREDITED
RESERVOIR_B_CREDITED
RESERVOIR_ENTRY_REVERSED
RESERVOIR_USE_REQUESTED/APPROVED/POSTED
RESERVOIR_TRANSFER_POSTED
BONUS_DESTINATION_ROUTED

All monetary events include amount/currency, earning qualification, period, rule/parameter/calendar references and correlation/replay IDs; never duplicate PII.

## 3. Destination router contract
Input: sealed/eligible calculation evidence + historical Qualification ownership + member eligibility + rule/period evidence.
Order: SYSTEM owner -> B; else valid member entitlement -> Member; else explicit undistributed reason -> A. Missing historical ownership/evidence -> FAIL CLOSED. Router emits exactly one destination identity per economic amount and an idempotent routing key.

## 4. System Ball lifecycle APIs
Admin reads: GET /admin/system-balls; GET /admin/system-balls/:qualificationId; GET /admin/system-balls/:qualificationId/ownership-history; GET /admin/system-assignment/pool.
Admin mutations (future): POST /admin/system-balls/:id/assign; POST /admin/qualifications/:id/reclaim-to-system; POST /admin/system-assignment/pool/:id/enable|disable. Require idempotency, reason, effectiveAt, policy/approval reference, serializable/concurrency protection and audit.

Assignment/reclaim endpoints never recreate qualificationId or organization edges.

## 5. Reservoir APIs
GET /admin/reservoirs; GET /admin/reservoirs/:code/ledger; GET /admin/reservoirs/:code/reconciliation.
POST /admin/reservoirs/:code/use-requests; POST /admin/reservoirs/use-requests/:id/approve; POST /admin/reservoirs/use-requests/:id/post; optional POST /admin/reservoirs/transfers only after approval policy is frozen.
No endpoint accepts direct new balance.

## 6. RBAC delta
SYSTEM_BALL_ADMIN: assign/reclaim/pool operations; cannot spend reservoirs unless separately authorized.
RESERVOIR_VIEWER: read balances/ledger/reconciliation.
RESERVOIR_OPERATOR: create use requests, cannot self-approve above policy.
RESERVOIR_APPROVER: approve under threshold/segregation policy.
FINANCE/AUDITOR: reconciliation/evidence according to policy.
SUPER_ADMIN remains break-glass, audited; no silent bypass.
Exact role mapping/approval thresholds are Pending Decision before Production.

## 7. Replay/settlement delta
Settlement sealing includes ownership snapshot/reference and destination routing evidence. Replay may reverse A/B/member routing only append-only. Reservoir ledger is part of Golden reconciliation. A/B balances at any asOf must reconcile from ledger entries and replay reversals. Missing ownership snapshot blocks affected routing.

## 8. Analytics delta
Add read-only metrics: Reservoir A inflow/outflow/balance, Reservoir B inflow/outflow/balance, source bonus type/reason distributions, System Ball count/source/assignment/reclaim trend. Analytics cannot post reservoir entries. System Ball is excluded from Person NASL but may have separate operational System Ball analytics. Sonar must clearly distinguish SYSTEM-owned vs PERSON-owned Qualifications.

## 9. Backlog delta
New P0 Core epic: Ownership History + System Ball lifecycle.
New P0 Core epic: Bonus Destination Router + Reservoir A/B ledger.
New P0 Core epic: Replay/Settlement integration and reconciliation.
New P1 Admin epic: System Ball management and ownership history.
New P1 Finance epic: Reservoir dashboard/ledger/use approval workflow.
New P1 Analytics epic: System Ball/Reservoir operational reporting.

## 10. Sprint-plan delta
Do not insert into current R1.0B Core Closure. After Gate 0 and next-release branch cut:
Core Sprint A: ownership history + System Ball lifecycle + migration strategy for prospective ownership truth.
Core Sprint B: destination router + Reservoir ledger + idempotency/concurrency.
Core Sprint C: replay/sealing/reconciliation Golden.
Then V1.1 Identity/Compliance may integrate ownership-aware Qualification gates. V1.2 System Assignment uses SystemAssignmentPool. V1.3 Sonar/Analytics consumes ownership/reservoir read models.

## 11. Golden journeys
A Foundation System Ball -> Active override -> no own PV/BV -> downstream real volume -> bonus -> B.
B Person-owned inactive/ineligible -> calculated undistributed -> A.
C Eligible Person-owned -> Member Award only.
D System Ball assigned to Person at T -> before T bonus to B; after T normal member routing.
E Person exit/reclaim at T -> before T member rules; after T System rules/B.
F Replay changes entitlement A->Member with A reversal.
G Historical ownership correction B->Member or Member->B using append-only reversal/recovery.
H Company Reservoir use request -> approval -> debit; duplicate delivery no duplicate debit.
I Cross-reservoir transfer if enabled -> paired entries/shared transferId; A/B remain separate.

## 12. Production blockers for this delta
Approval thresholds/segregation of duties for company reservoir use; exact accounting/export mapping; migration/backfill policy for pre-next-release Qualification ownership; legal/accounting review of company-use reporting. These block only affected Production features and must not be guessed by Codex.