import { Prisma } from '@ucell/database';
import { PersonService } from '../src/modules/person/person.service';
import { PersonController } from '../src/modules/person/person.controller';

function harness(personExists = true) {
  const tx = {
    person: { findUnique: jest.fn(async () => personExists ? { personId: 'a' } : null) },
    qualification: { count: jest.fn(async () => 2), findMany: jest.fn(async () => [
      { qualificationId: 'ball-a', kind: 'MEMBER_ORIGIN', planLevelCode: 'STARTER', binaryTreeMembership: null, canonicalPosition: null, ownerIntervals: [], companyProfileBindings: [], globalRankHistory: [] },
      { qualificationId: 'ball-b', kind: 'MEMBER_ORIGIN', planLevelCode: 'STARTER', binaryTreeMembership: null, canonicalPosition: null, ownerIntervals: [], companyProfileBindings: [], globalRankHistory: [] },
    ]) },
    qualificationPlanHistory: { findMany: jest.fn(async () => []) },
  };
  const prisma = { $transaction: jest.fn(async (work: any) => work(tx)) };
  return { tx, prisma, service: new PersonService(prisma as any, {} as any, {} as any) };
}
const personId = '00000000-0000-0000-0000-000000000001';
describe('Admin Person current Qualifications read model', () => {
  it('filters exact current holder, stable paginates and snapshots rows/count together', async () => {
    const { service, prisma, tx } = harness();
    const result = await service.qualifications(personId, 1, 1);
    expect(result.meta).toEqual({ total: 2, take: 1, skip: 1 });
    expect(result.data.map((row: any) => row.qualificationId)).toEqual(['ball-a', 'ball-b']);
    expect(result.data.every((row: any) => row.admin360?.schemaVersion === 'ADMIN_QUALIFICATION_360_V1')).toBe(true);
    expect(result.data.every((row: any) => row.admin360?.plan?.status === 'UNAVAILABLE')).toBe(true);
    expect(tx.qualification.count).toHaveBeenCalledWith({ where: { currentHolderPersonId: personId } });
    expect(tx.qualification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { currentHolderPersonId: personId }, take: 1, skip: 1, orderBy: [{ createdAt: 'desc' }, { qualificationId: 'asc' }],
      include: expect.objectContaining({ binaryTreeMembership: expect.any(Object), ownerIntervals: expect.any(Object), companyProfileBindings: expect.any(Object), globalRankHistory: expect.any(Object) }),
    }));
    expect(tx.qualificationPlanHistory.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
  it('rejects invalid input before querying and missing Person as 404', async () => {
    const { service, prisma } = harness();
    for (const [id, take, skip] of [['forged', 20, 0], [personId, NaN, 0], [personId, 101, 0], [personId, 1.5, 0], [personId, 20, -1], [personId, 20, Number.MAX_SAFE_INTEGER + 1]] as [string, number, number][]) {
      await expect(service.qualifications(id, take, skip)).rejects.toMatchObject({ status: 422 });
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await expect(harness(false).service.qualifications(personId)).rejects.toMatchObject({ status: 404 });
  });
  it('keeps existing Person roles and controller forwards validated pagination', async () => {
    expect(Reflect.getMetadata('roles', PersonController)).toEqual(['SUPER_ADMIN', 'MEMBERSHIP_OPS', 'COMPLIANCE_AUDIT']);
    const service = { qualifications: jest.fn(async () => ({ data: [], meta: { total: 0, take: 20, skip: 0 } })) };
    await new PersonController(service as any,{} as any).qualifications(personId);
    expect(service.qualifications).toHaveBeenCalledWith(personId, 20, 0);
  });
});
