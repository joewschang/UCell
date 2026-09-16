# UCell Next Release — System Ball & Reservoir A/B Core Specification
Status: APPROVED NEXT-RELEASE CORE BASELINE
Date: 2026-09-16
Scope: next-version Core. This specification does not retroactively change current R1.0B historical monetary facts.

## 1. System Ball definition
A System Ball is a Qualification/Ball whose effective owner is SYSTEM during a defined ownership interval. It remains a real organization node with stable qualificationId and preserved Sponsor/Binary position/history. System Ball is not a membership rank or bonus type.

## 2. Sources
System Ball sourceReason is one of:
FOUNDATION — foundation/base nodes created to establish initial organization trees.
MEMBER_EXIT_RECLAIM — a member-owned Qualification reclaimed by the system after the applicable exit process.
SPECIAL_PLACEMENT — a Qualification created/designated under an approved exceptional placement strategy.
Future source reasons require a new versioned policy; never silently overload these values.

## 3. Ownership lifecycle
Qualification ownership is effective-dated and historical:
QualificationOwnershipHistory(id, qualificationId, ownerType SYSTEM|PERSON, ownerPersonId?, sourceReason, effectiveFrom, effectiveTo?, policyVersion?, approvalRef?, correlationId, createdAt).
A Qualification is System Ball exactly when the historical/effective ownership record says ownerType=SYSTEM.

Assignment SYSTEM -> PERSON changes ownership prospectively at effectiveAt; qualificationId and organization edges are not recreated. Reclaim PERSON -> SYSTEM likewise preserves the node and history. Replay uses ownership at earning/recognition period, never current owner.

## 4. System Ball operational behavior
While SYSTEM-owned:
- default Active = TRUE through explicit SYSTEM_ACTIVE_OVERRIDE/equivalent evidence;
- no PV/BV is generated merely from System ownership, creation, reclaim, assignment, default Active or placement;
- real downstream/member transactions retain their normal authoritative volume recognition;
- Sponsor/Binary position/history remains valid;
- Carry is preserved under applicable Core rules;
- the Ball participates in bonus calculation so theoretical/calculated entitlement is auditable;
- no Person Payable is created for System-owned earning interval;
- calculated System Ball bonus is routed to Reservoir B.

When assigned to a Person, future transactions/awards after effective ownership change follow normal Person-owned Qualification rules. Historical Reservoir B allocations do not become the assignee's property merely because ownership changed later.

## 5. Reservoir A — Undistributed Bonus Reservoir
Canonical code: RESERVOIR_A_UNDISTRIBUTED.
Purpose: receive calculated bonus allocation that is not distributed to a member because an applicable rule/eligibility/Active/qualification condition prevents member entitlement/payable, provided the earning Qualification is not SYSTEM-owned.
Every allocation records source period, bonus type, source/earning qualification, theoretical/calculated amount, reasonCode, ruleVersion, parameter/calendar references and correlation/replay identity.

## 6. Reservoir B — System Ball Bonus Reservoir
Canonical code: RESERVOIR_B_SYSTEM_BALL.
Purpose: receive 100% of bonus amount calculated for an earning Qualification that is SYSTEM-owned at the applicable historical earning/recognition period. No Person Award/Payable is created for that amount. Preserve calculation evidence and route to B ledger.

## 7. Routing precedence
Each calculated bonus economic amount must have exactly one primary destination:
1. If earning Qualification is SYSTEM-owned at the applicable historical time -> Reservoir B.
2. Else if member entitlement/payable is valid -> Member Award/Ledger according to Core.
3. Else -> Reservoir A according to explicit undistributed reason.
No amount may be credited to both A and B or to a reservoir and Member Payable simultaneously.

## 8. Reservoir ledger
Do not store mutable balances as source of truth. Use append-only CompanyReservoirLedger:
id, reservoirCode A|B, entryType CREDIT|DEBIT|REVERSAL|ADJUSTMENT|TRANSFER, amount, currency, sourceType, sourceId, earningQualificationId?, periodId?, bonusType?, reasonCode, ruleVersion?, parameterHash?, calendarVersion?, replayRunId?, correlationId, approvedBy?, occurredAt, createdAt, metadataHash.
Balance is SUM(signed ledger entries) under authoritative query/read model.

Company flexible use of A/B is implemented only through authorized ledger DEBIT/TRANSFER/ADJUSTMENT workflows with reason, operator, approval evidence and audit. No direct UPDATE balance.

## 9. Company-use governance
A and B are separate reservoirs and must remain separately reportable even if company policy allows flexible use. Cross-reservoir transfer, if enabled, is an explicit paired transfer with shared transferId; never merge balances. Define Admin RBAC and approval threshold before Production use.

## 10. Replay / reversal
Historical replay never edits original reservoir entries. If original routing becomes incorrect, append reversal and new destination entry.
Example: member originally ineligible -> A CREDIT 8,000; replay proves eligible -> A REVERSAL -8,000 + Member Adjustment +8,000.
Example: historical owner corrected SYSTEM -> PERSON -> B REVERSAL + member adjustment if entitlement is otherwise valid.
Example: PERSON -> SYSTEM historical correction -> reverse member/other route under existing recovery rules + B CREDIT.
All replay uses historical ownership, Active, Sponsor/Binary, rule/parameter/calendar evidence and remains fail-closed if evidence is missing.

## 11. Data model additions
QualificationOwnershipHistory.
SystemBallMetadata/Policy reference where useful (foundation/reclaim/special reason; not a duplicate owner truth).
SystemAssignmentPoolEntry remains distinct: all pool entries are eligible System Balls, but not every System Ball must be eligible for automatic assignment.
CompanyReservoir.
CompanyReservoirLedger.
ReservoirTransfer/ApprovalEvidence where company-use workflow requires.
BonusCalculationEvidence gains destinationType MEMBER|RESERVOIR_A|RESERVOIR_B and destinationReasonCode/reference while preserving existing monetary evidence model.

## 12. System Assignment relationship
SYSTEM_ASSIGNMENT chooses only from approved SystemAssignmentPool entries under the versioned policy. A System Ball may be excluded from automatic assignment while still being SYSTEM-owned, Active-by-override and routing its calculated bonus to Reservoir B.

## 13. APIs/read models (future)
Admin read: /admin/system-balls, /admin/system-balls/:qualificationId/ownership-history, /admin/reservoirs, /admin/reservoirs/:code/ledger.
Admin mutation (strict RBAC/approval): assign/reclaim System Ball; enable/disable assignment-pool entry; authorized reservoir use/transfer. Monetary/reservoir mutations require idempotency, serializable safety, outbox/audit and approval policy.

## 14. Tests required
Foundation System Ball; member exit reclaim; special placement; SYSTEM->PERSON effective boundary; PERSON->SYSTEM boundary; default Active without PV/BV generation; downstream real volume preserved; System Ball bonus -> B only; Person ineligible bonus -> A only; eligible Person -> Member only; duplicate delivery; concurrent routing; reservoir debit/transfer approval; replay A->Member, B->Member, Member->B; historical ownership missing -> fail closed; no double destination; ledger reconciliation; sealed settlement/replay evidence.

## 15. Invariants
System Ball != fake member. System Ball != special bonus rank. Active != PV/BV generation. Ownership change != organization-node recreation. Reservoir balance != editable field. Company flexible use != unaudited mutation. A != B and must remain separately traceable. Analytics may report reservoirs but cannot mutate them.
