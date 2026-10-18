import { PrismaClient, OrderPurpose, OrderStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { QualificationWorkflowService } from '../src/modules/qualification/qualification-workflow.service';
import { OrderService } from '../src/modules/order/order.service';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { AuditService } from '../src/common/audit/audit.service';
import { OutboxService } from '../src/common/outbox/outbox.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
if (!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))) throw Error('ISOLATED_DATABASE_REQUIRED');
const directions = [
  { from: 'STARTER', to: 'ELITE', difference: 28800 },
  { from: 'ELITE', to: 'LEADER', difference: 28800 },
  { from: 'STARTER', to: 'LEADER', difference: 57600 },
];
const scenarios = [
  'FORGED_REFERENCES', 'UNPAID_ORDERS', 'FEE_ONLY', 'DIFFERENCE_ONLY',
  'FEE_SHORT_BY_ONE', 'OTHER_QUALIFICATION', 'WRONG_CURRENCY',
  'RETAIL_PURPOSE', 'VOIDED_AFTER_PAYMENT', 'RETURNED_AFTER_PAYMENT',
  'PAID_PROJECTION_WITHOUT_EVENT',
] as const;
type Scenario = typeof scenarios[number];

describe('Legacy payment payload cannot replace explicit manual ERP confirmation', () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const service = new QualificationWorkflowService(db as any, {} as any);
  const orders = new OrderService(db as any, new IdempotencyService(db as any), new AuditService(), new OutboxService());
  const evidence: unknown[] = [];
  afterAll(async () => {
    try {
      if (process.env.UPGRADE_PAYMENT_MATRIX_EVIDENCE_PATH) writeFileSync(process.env.UPGRADE_PAYMENT_MATRIX_EVIDENCE_PATH, JSON.stringify({
        boundaries: [
          'Synthetic local DB only. Order shells are fixtures; payment events are produced by actual OrderService.confirmPayment.',
          'No live provider, HTTP authorization, bank transfer, goods or downstream SALE_CONFIRMED consumer is exercised.',
          'VOIDED/RETURNED states are fixture transitions, not evidence of a completed real refund workflow.',
          'Payload order references are adversarial caller input, not an implemented or approved evidence binding contract.',
          'All scenarios are rejection requirements. There is no claimed successful valid paid upgrade in this matrix.',
        ], results: evidence,
      }, null, 2));
    } finally { await db.$disconnect(); }
  });
  async function qualification(from: string) {
    const person = await db.person.create({ data: { legalName: 'SYNTHETIC UPGRADE PAYMENT MATRIX' } });
    const q = await db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: from, status: 'EFFECTIVE' } });
    await db.qualificationPlanHistory.create({ data: { qualificationId: q.qualificationId, planCode: from, effectiveFrom: new Date('2024-01-01Z'), sourceType: 'TEST' } });
    return q.qualificationId;
  }
  async function order(qualificationId: string, amount: number, scenario: Scenario) {
    const projectionOnly = scenario === 'PAID_PROJECTION_WITHOUT_EVENT';
    const purpose: OrderPurpose = scenario === 'RETAIL_PURPOSE' ? 'RETAIL' : 'UPGRADE';
    const row = await db.order.create({ data: {
      qualificationId, purpose, status: projectionOnly ? 'PAID' : 'CONFIRMED',
      currency: scenario === 'WRONG_CURRENCY' ? 'USD' : 'TWD',
      grossAmount: amount, netAmount: amount, ruleVersionCode: 'R1.0B', confirmedAt: new Date(),
      paidAt: projectionOnly ? new Date() : null,
    } });
    if (scenario !== 'UNPAID_ORDERS' && !projectionOnly) {
      await orders.confirmPayment(row.orderId, {
        amount: String(amount), occurredAt: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER', referenceNo: 'SYNTHETIC-' + randomUUID(),
      }, randomUUID(), randomUUID());
      expect(await db.paymentEvent.count({ where: { orderId: row.orderId, eventType: 'PAYMENT_CONFIRMED' } })).toBe(1);
    }
    const terminal: OrderStatus | undefined = scenario === 'VOIDED_AFTER_PAYMENT' ? 'VOIDED' : scenario === 'RETURNED_AFTER_PAYMENT' ? 'RETURNED' : undefined;
    if (terminal) await db.order.update({ where: { orderId: row.orderId }, data: { status: terminal } });
    return row.orderId;
  }
  it.each(directions.flatMap(direction => scenarios.map(scenario => ({ ...direction, scenario }))))(
    '$from->$to / $scenario: without explicit ERP confirmation must preserve the original plan', async ({ from, to, difference, scenario }) => {
      const qualificationId = await qualification(from);
      const orderQualificationId = scenario === 'OTHER_QUALIFICATION' ? await qualification(from) : qualificationId;
      let differenceOrderId: string | undefined;
      let reviewFeeOrderId: string | undefined;
      if (scenario === 'FORGED_REFERENCES') {
        differenceOrderId = randomUUID(); reviewFeeOrderId = randomUUID();
      } else {
        if (scenario !== 'FEE_ONLY') differenceOrderId = await order(orderQualificationId, difference, scenario);
        if (scenario !== 'DIFFERENCE_ONLY') reviewFeeOrderId = await order(orderQualificationId, scenario === 'FEE_SHORT_BY_ONE' ? 599 : 600, scenario);
      }
      const storedOrders = await db.order.findMany({ where: { orderId: { in: [differenceOrderId, reviewFeeOrderId].filter((id): id is string => !!id) } }, include: { paymentEvents: true } });
      expect(storedOrders).toHaveLength(scenario === 'FORGED_REFERENCES' ? 0 : ['FEE_ONLY', 'DIFFERENCE_ONLY'].includes(scenario) ? 1 : 2);
      if (['UNPAID_ORDERS', 'PAID_PROJECTION_WITHOUT_EVENT'].includes(scenario)) expect(storedOrders.every(o => o.paymentEvents.length === 0)).toBe(true);
      const wf = await service.submit({ qualificationId, workflowType: 'UPGRADE', targetPlanCode: to,
        payload: { reviewFeePaid: true, differencePaid: true, differenceOrderId, reviewFeeOrderId, sourcePlanCode: from, targetPlanCode: to } });
      let rejection: { status: number; message: string } | null = null;
      try { await service.approve(wf.qualificationWorkflowId); }
      catch (error) {
        // A database/setup error is not a successful business rejection.
        if ((error as any).getStatus?.() !== 422) throw error;
        rejection = { status: 422, message: (error as Error).message };
      }
      const stored = await db.qualificationWorkflow.findUniqueOrThrow({ where: { qualificationWorkflowId: wf.qualificationWorkflowId } });
      const q = await db.qualification.findUniqueOrThrow({ where: { qualificationId } });
      const histories = await db.qualificationPlanHistory.findMany({ where: { qualificationId }, orderBy: { effectiveFrom: 'asc' } });
      const actual = { rejected: !!rejection, workflow: stored.status, plan: q.planLevelCode, histories: histories.length, originalStillOpen: histories[0].effectiveTo === null };
      evidence.push({ from, to, difference, scenario, actual, rejection, orders: storedOrders.map(o => ({
        sameQualification: o.qualificationId === qualificationId, purpose: o.purpose, currency: o.currency, status: o.status, amount: o.netAmount.toString(),
        paymentEvents: o.paymentEvents.map(e => ({ type: e.eventType, amount: e.amount.toString() })),
      })) });
      expect(actual).toEqual({ rejected: true, workflow: 'SUBMITTED', plan: from, histories: 1, originalStillOpen: true });
    });
  it.each(directions)('$from->$to: missing fee flag control rejects without mutation', async ({ from, to }) => {
    const qualificationId = await qualification(from);
    const wf = await service.submit({ qualificationId, workflowType: 'UPGRADE', targetPlanCode: to });
    await expect(service.approve(wf.qualificationWorkflowId)).rejects.toMatchObject({ status: 422, message: 'UPGRADE_PAYMENT_CONFIRMATION_REQUIRED' });
    expect(await db.qualification.findUniqueOrThrow({ where: { qualificationId } })).toMatchObject({ planLevelCode: from });
    expect(await db.qualificationWorkflow.findUniqueOrThrow({ where: { qualificationWorkflowId: wf.qualificationWorkflowId } })).toMatchObject({ status: 'SUBMITTED' });
    expect(await db.qualificationPlanHistory.count({ where: { qualificationId } })).toBe(1);
  });
});
