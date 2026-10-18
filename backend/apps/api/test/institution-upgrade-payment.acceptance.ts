// Strict business acceptance gate: deliberately reports the unresolved payment
// evidence gap. Run with test:institution:acceptance; never convert to skip/todo.
import { PrismaClient } from '@prisma/client';
import { QualificationWorkflowService } from '../src/modules/qualification/qualification-workflow.service';
const url = process.env.PHASE2_TEST_DATABASE_URL;
if (!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))) throw Error('ISOLATED_DATABASE_REQUIRED');
describe('Core v4.2 P28/P29 strict upgrade payment acceptance', () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const service = new QualificationWorkflowService(db as any, {} as any);
  afterAll(() => db.$disconnect());
  it.each([
    { from: 'STARTER', to: 'ELITE', difference: 28800 },
    { from: 'ELITE', to: 'LEADER', difference: 28800 },
    { from: 'STARTER', to: 'LEADER', difference: 57600 },
  ])('$from->$to: unpaid difference $difference and review fee 600 cannot be replaced by a boolean', async ({ from, to }) => {
    const person = await db.person.create({ data: { legalName: 'SYNTHETIC UNPAID ACCEPTANCE' } });
    const q = await db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: from, status: 'EFFECTIVE' } });
    await db.qualificationPlanHistory.create({ data: { qualificationId: q.qualificationId, planCode: from, effectiveFrom: new Date('2024-01-01Z'), sourceType: 'TEST' } });
    expect(await db.order.count({ where: { qualificationId: q.qualificationId } })).toBe(0);
    const wf = await service.submit({ qualificationId: q.qualificationId, workflowType: 'UPGRADE', targetPlanCode: to, payload: { reviewFeePaid: true } });
    let rejected = false;
    try { await service.approve(wf.qualificationWorkflowId); } catch { rejected = true; }
    const stored = await db.qualificationWorkflow.findUniqueOrThrow({ where: { qualificationWorkflowId: wf.qualificationWorkflowId } });
    const ball = await db.qualification.findUniqueOrThrow({ where: { qualificationId: q.qualificationId } });
    expect({ rejected, status: stored.status, plan: ball.planLevelCode,
      histories: await db.qualificationPlanHistory.count({ where: { qualificationId: q.qualificationId } })
    }).toEqual({ rejected: true, status: 'SUBMITTED', plan: from, histories: 1 });
  });
});
