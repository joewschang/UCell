import { PrismaClient } from '@prisma/client';
import { QualificationWorkflowService } from '../src/modules/qualification/qualification-workflow.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
(url ? describe : describe.skip)('Institution core v4.2 P28 upgrade direction and effective history', () => {
  let db: PrismaClient;
  let service: QualificationWorkflowService;
  let principal:any;
  const payment={paymentConfirmed:true,erpPaymentVoucher:'ERP-SYNTHETIC-001'};
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    service = new QualificationWorkflowService(db as any, {} as any);
    const actor=await db.person.create({data:{legalName:'SYNTHETIC APPROVER'}});
    principal={personId:actor.personId,provider:'ENTRA',role:'SUPER_ADMIN'};
  });
  afterAll(() => db?.$disconnect());
  async function fixture(plan: string) {
    const person = await db.person.create({ data: { legalName: 'SYNTHETIC UPGRADE' } });
    const q = await db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: plan, status: 'EFFECTIVE' } });
    await db.qualificationPlanHistory.create({ data: { qualificationId: q.qualificationId, planCode: plan, effectiveFrom: new Date('2024-01-01Z'), sourceType: 'TEST' } });
    return q.qualificationId;
  }
  const plans = ['STARTER', 'ELITE', 'LEADER'];
  it.each(plans.flatMap((from, i) => plans.map((to, j) => ({ from, to, allowed: j > i }))))('$from -> $to: strictly upward=$allowed', async ({ from, to, allowed }) => {
    const qualificationId = await fixture(from);
    const operation = service.submit({ qualificationId, workflowType: 'UPGRADE', targetPlanCode: to, payload: { reviewFeePaid: true } });
    if (!allowed) {
      await expect(operation).rejects.toThrow('UPGRADE_TARGET_MUST_BE_HIGHER');
      expect(await db.qualificationWorkflow.count({ where: { qualificationId } })).toBe(0);
      return;
    }
    const wf = await operation;
    expect(wf.reviewFee.toString()).toBe('600');
    const approved = await service.approve(wf.qualificationWorkflowId,undefined,principal,payment);
    const history = await db.qualificationPlanHistory.findMany({ where: { qualificationId }, orderBy: { effectiveFrom: 'asc' } });
    expect(history).toHaveLength(2);
    expect(history[0].planCode).toBe(from);
    expect(history[0].effectiveTo).toEqual(approved.effectiveAt);
    expect(history[1]).toMatchObject({ planCode: to, effectiveFrom: approved.effectiveAt, effectiveTo: null });
    await expect(service.approve(wf.qualificationWorkflowId,undefined,principal,payment)).rejects.toThrow('Workflow is not SUBMITTED');
    expect(await db.qualificationPlanHistory.count({ where: { qualificationId } })).toBe(2);
  });
  it('rechecks stale submitted upgrades atomically at approval', async () => {
    const qualificationId = await fixture('STARTER');
    const lower = await service.submit({ qualificationId, workflowType: 'UPGRADE', targetPlanCode: 'ELITE', payload: { reviewFeePaid: true } });
    const higher = await service.submit({ qualificationId, workflowType: 'UPGRADE', targetPlanCode: 'LEADER', payload: { reviewFeePaid: true } });
    await service.approve(higher.qualificationWorkflowId,undefined,principal,payment);
    await expect(service.approve(lower.qualificationWorkflowId,undefined,principal,payment)).rejects.toThrow('UPGRADE_TARGET_MUST_BE_HIGHER');
    expect(await db.qualificationWorkflow.findUnique({ where: { qualificationWorkflowId: lower.qualificationWorkflowId } })).toMatchObject({ status: 'SUBMITTED' });
    expect(await db.qualificationPlanHistory.count({ where: { qualificationId } })).toBe(2);
  });
  it.each(['UNKNOWN', '', 'starter'])('rejects unsupported target %s without persistence', async targetPlanCode => {
    const qualificationId = await fixture('STARTER');
    await expect(service.submit({ qualificationId, workflowType: 'UPGRADE', targetPlanCode })).rejects.toThrow();
    expect(await db.qualificationWorkflow.count({ where: { qualificationId } })).toBe(0);
  });
  it('unconfirmed review fee and backdating cannot change plan history', async () => {
    const qualificationId = await fixture('STARTER');
    const wf = await service.submit({ qualificationId, workflowType: 'UPGRADE', targetPlanCode: 'ELITE' });
    await expect(service.approve(wf.qualificationWorkflowId)).rejects.toThrow('UPGRADE_PAYMENT_CONFIRMATION_REQUIRED');
    await db.qualificationWorkflow.update({ where: { qualificationWorkflowId: wf.qualificationWorkflowId }, data: { payload: { reviewFeePaid: true } } });
    await expect(service.approve(wf.qualificationWorkflowId, new Date('2024-01-01Z'),principal,payment)).rejects.toThrow('cannot be backdated');
    expect(await db.qualificationPlanHistory.count({ where: { qualificationId } })).toBe(1);
  });
});
