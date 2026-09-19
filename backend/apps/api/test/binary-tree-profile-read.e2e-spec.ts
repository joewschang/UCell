import { readCompanyProfileStatus } from '../src/modules/binary-tree/binary-tree-read.service';

const at = new Date('2026-09-19T00:00:00.000Z');
const input = {
  binaryTreeId: 'tree-internal-id',
  qualificationId: 'qualification-internal-id',
  positionNo: 1,
  qualificationKind: 'COMPANY_BOOTSTRAP',
  ownerType: 'COMPANY',
  ownerCompanyPrincipalId: 'company-internal-id',
  treeCompanyPrincipalId: 'company-internal-id',
  at,
  known: at,
};

const binding = {
  profileVersion: 'COMPANY_BOOTSTRAP_PROFILE_V1',
  planCode: 'LEADER',
  ruleVersion: 'R1.0B',
  parameterVersion: 'a'.repeat(64),
  snapshotHash: 'b'.repeat(64),
};

describe('Tree Company LEADER profile read', () => {
  it('exposes LEADER only from one sealed, effective Company bootstrap binding', async () => {
    const findMany = jest.fn(async () => [binding]);

    await expect(readCompanyProfileStatus({ companyBootstrapProfileBinding: { findMany } } as any, input)).resolves.toEqual({
      status: 'AVAILABLE', planCode: 'LEADER', profileVersion: 'COMPANY_BOOTSTRAP_PROFILE_V1',
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        qualificationId: 'qualification-internal-id', binaryTreeId: 'tree-internal-id', companyPosition: 1,
      }),
      take: 2,
    }));
  });

  it('fails closed for missing or ambiguous evidence and never upgrades a member-origin Company-held Ball', async () => {
    const absent = jest.fn(async () => []);
    await expect(readCompanyProfileStatus({ companyBootstrapProfileBinding: { findMany: absent } } as any, input)).resolves.toMatchObject({
      status: 'UNAVAILABLE', planCode: null,
    });
    const ambiguous = jest.fn(async () => [binding, binding]);
    await expect(readCompanyProfileStatus({ companyBootstrapProfileBinding: { findMany: ambiguous } } as any, input)).resolves.toMatchObject({
      status: 'UNAVAILABLE', planCode: null,
    });
    const memberOrigin = jest.fn();
    await expect(readCompanyProfileStatus({ companyBootstrapProfileBinding: { findMany: memberOrigin } } as any, {
      ...input, qualificationKind: 'MEMBER_ORIGIN', positionNo: 4,
    })).resolves.toMatchObject({ status: 'UNAVAILABLE', planCode: null });
    expect(memberOrigin).not.toHaveBeenCalled();
  });
});
