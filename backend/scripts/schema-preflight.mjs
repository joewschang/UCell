import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const schema=fs.readFileSync(path.join(root,'packages/database/prisma/schema.prisma'),'utf8');
const failures=[];

function modelBlock(name){
  const m=schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return m?.[1] ?? '';
}
function must(re,msg){ if(!re.test(schema)) failures.push(msg); }

const person=modelBlock('Person');
const qualification=modelBlock('Qualification');
const payoutLine=modelBlock('PayoutLine');
const recovery=modelBlock('BonusRecoveryEvent');
const payable=modelBlock('PayableEntry');
const payment=modelBlock('Payment');
const paymentClaim=modelBlock('PaymentOperationClaim');
const inventoryBalance=modelBlock('InventoryBalance');
const inventoryMovement=modelBlock('InventoryMovement');
const inventoryClaim=modelBlock('InventoryOperationClaim');
const volumeClassification=modelBlock('VolumeRecognitionClassification');
const consumptionRecognition=modelBlock('ConsumptionRecognitionEvent');
const accumulatorEvidence=modelBlock('QualificationMonthAccumulatorEvidence');
const activeIntervalEvidence=modelBlock('ActiveIntervalEvidence');
const theoryEvidence=modelBlock('TheoryCalculationEvidence');
const binaryVolumeLedger=modelBlock('BinaryVolumeLedger');
const settlementCalendarEvidence=modelBlock('SettlementCalendarEvidence');
const awardPayoutAnchor=modelBlock('AwardPayoutAnchor');
const reservoirEffect=modelBlock('ReservoirLedgerEffect');
const welfareEffect=modelBlock('WelfarePoolEffect');

if(!/qualifications\s+Qualification\[\]/.test(person)) failures.push('Person must own Qualifications');
if(/payoutLines\s+PayoutLine\[\]/.test(person)) failures.push('Person must not directly own payout lines');
if(!/payoutLines\s+PayoutLine\[\]/.test(qualification)) failures.push('Qualification must own payout lines');
if(!/recipientQualificationId/.test(payoutLine)) failures.push('PayoutLine must be qualification-scoped');
if(!/outstandingAmount/.test(recovery)) failures.push('Recovery outstanding balance required');
must(/model RecoveryApplication\s*\{/,'RecoveryApplication model required');
must(/enum BonusAwardType\s*\{[\s\S]*?\bRPV\b[\s\S]*?\bGLOBAL\b/,'RPV and GLOBAL award types required');
if(!/qualification\s+Qualification/.test(payable)) failures.push('PayableEntry qualification relation required');
must(/model IdentityLink\s*\{/,'IdentityLink required');
must(/model AuthSession\s*\{/,'AuthSession required');
must(/model GoldenCaseRun\s*\{/,'GoldenCaseRun required');
must(/model PaymentProviderEventEvidence\s*\{/,'Payment provider evidence persistence required');
must(/model PaymentStateTransition\s*\{/,'Payment state transition persistence required');
must(/model InventoryReservationLine\s*\{/,'Inventory reservation line persistence required');
must(/model InventoryBalanceEvidence\s*\{/,'Inventory balance evidence persistence required');
if(!/orderId\s+String/.test(payment) || !/providerTransactionRef/.test(payment)) failures.push('Payment must bind Order and provider transaction reference');
if(!/businessEffectIdentity\s+String\s+@unique/.test(paymentClaim) || !/outboxEventId\s+String\s+@unique/.test(paymentClaim)) failures.push('Payment operation claim must uniquely bind effect and outbox evidence');
if(!/@@id\(\[warehouseId, inventoryItemId\]\)/.test(inventoryBalance)) failures.push('InventoryBalance must be warehouse/item scoped');
if(!/idempotencyKey\s+String\s+@unique/.test(inventoryMovement)) failures.push('InventoryMovement idempotency key must be unique');
if(!/operationHash/.test(inventoryClaim) || !/resultHash/.test(inventoryClaim) || !/outboxEventId\s+String\s+@unique/.test(inventoryClaim)) failures.push('Inventory operation claim must bind deterministic result and outbox evidence');
must(/enum VolumeClass\s*\{[\s\S]*?\bPV\b[\s\S]*?\bBV\b/,'PV/BV abstract VolumeClass required');
must(/enum ConcreteVolumeType\s*\{[\s\S]*?\bGPV\b[\s\S]*?\bRPV\b[\s\S]*?\bEPV\b/,'GPV/RPV/EPV concrete volume types required');
if(!/volumeEventId\s+String\s+@unique/.test(volumeClassification)) failures.push('Concrete classification must be one-to-one with an existing volume event');
if(!/idempotencyKey\s+String\s+@unique/.test(consumptionRecognition) || !/reversalOfEventId/.test(consumptionRecognition)) failures.push('Consumption recognition must be idempotent and reversal-linked');
if(!/qualificationId/.test(accumulatorEvidence) || !/calendarMonth/.test(accumulatorEvidence) || !/thresholdCrossed/.test(accumulatorEvidence)) failures.push('Qualification-month accumulator evidence required');
if(!/activeFrom/.test(activeIntervalEvidence) || !/activeTo/.test(activeIntervalEvidence) || !/supersedesActiveEvidenceId/.test(activeIntervalEvidence)) failures.push('Append-only Active interval replay evidence required');
if(!/fixedGenerationNo/.test(theoryEvidence) || !/reasonCode/.test(theoryEvidence) || !/theoryAmount/.test(theoryEvidence)) failures.push('Fixed-generation theory and zero evidence required');
if(!/ancestorQualificationId/.test(binaryVolumeLedger) || !/historicalBinaryPathHash/.test(binaryVolumeLedger) || !/side\s+SideCode/.test(binaryVolumeLedger)) failures.push('Qualification-scoped Binary volume ledger required');
must(/model BusinessCalendarVersion\s*\{/,'BusinessCalendarVersion required');
must(/model BusinessCalendarDate\s*\{/,'Versioned business calendar dates required');
if(!/settlementDate/.test(settlementCalendarEvidence) || !/settlementSlot/.test(settlementCalendarEvidence) || !/businessCalendarVersionId/.test(settlementCalendarEvidence)) failures.push('Settlement date/slot/calendar evidence required');
if(!/nominalPayoutDate/.test(awardPayoutAnchor) || !/adjustedPayoutDate/.test(awardPayoutAnchor) || !/bonusAwardId\s+String\s+@unique/.test(awardPayoutAnchor)) failures.push('Immutable Award payout anchor required');
if(!/sourceGlobalSettlementId/.test(reservoirEffect) || !/idempotencyKey\s+String\s+@unique/.test(reservoirEffect)) failures.push('Idempotent Reservoir A source-period effect required');
if(!/REPLAY_ADJUSTMENT/.test(schema) || !/replayActionKey\s+String\?\s+@unique/.test(reservoirEffect)) failures.push('Signed exactly-once Reservoir replay adjustment required');
if(!/welfarePoolAccrualId/.test(welfareEffect) || !/amount\s+Decimal/.test(welfareEffect) || !/replayActionKey\s+String\?\s+@unique/.test(welfareEffect)) failures.push('Append-only signed Welfare replay effect required');

if(failures.length){
  console.error('SCHEMA_PREFLIGHT_FAIL');
  for(const f of failures) console.error('-',f);
  process.exit(1);
}
console.log('SCHEMA_PREFLIGHT_PASS');
