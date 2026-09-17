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

if(failures.length){
  console.error('SCHEMA_PREFLIGHT_FAIL');
  for(const f of failures) console.error('-',f);
  process.exit(1);
}
console.log('SCHEMA_PREFLIGHT_PASS');
