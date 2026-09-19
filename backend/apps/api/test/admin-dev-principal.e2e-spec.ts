import { AdminDevReadOnlyGuard } from '../src/admin-dev';

const personId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const subject = 'isolated-entra-subject';

function fixture(overrides: Record<string, unknown> = {}) {
  const request: any = {
    method: 'GET',
    url: '/api/v1/admin/organization/trees',
    headers: { 'x-ucell-dev-actor-id': personId },
  };
  const prisma: any = {
    person: {
      findUnique: jest.fn(async () => ({ personId })),
      findMany: jest.fn(async () => [{ personId }]),
    },
    identityLink: { findMany: jest.fn(async () => [{ providerSubject: subject }]) },
    adminAccessGrant: { findMany: jest.fn(async () => [{ roleCode: 'SUPER_ADMIN' }]) },
    authSession: { findMany: jest.fn(async () => [{ authSessionId: sessionId, roleCode: 'SUPER_ADMIN' }]) },
    ...overrides,
  };
  const config: any = {
    get: jest.fn((key: string) => ({
      NODE_ENV: 'development',
      UCELL_ADMIN_DEV_FULL_ACCESS: 'true',
    })[key]),
  };
  const guard = new AdminDevReadOnlyGuard(config, prisma);
  const context: any = { switchToHttp: () => ({ getRequest: () => request }) };
  return { guard, request, prisma, config, context };
}

describe('Admin DEV full-access Entra principal', () => {
  it('uses the single active Entra identity, grant, and session instead of ADMIN_LOCAL', async () => {
    const h = fixture();

    await expect(h.guard.canActivate(h.context)).resolves.toBe(true);

    expect(h.request.user).toEqual({
      sessionId,
      personId,
      provider: 'ENTRA',
      subject,
      role: 'SUPER_ADMIN',
    });
    expect(h.prisma.identityLink.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { personId, provider: 'ENTRA' },
      take: 2,
    }));
    expect(h.prisma.adminAccessGrant.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        personId,
        provider: 'ENTRA',
        providerSubject: subject,
        status: 'ACTIVE',
      }),
      take: 2,
    }));
  });

  it('rejects malformed actor headers before resolving a Person', async () => {
    const h = fixture();
    h.request.headers['x-ucell-dev-actor-id'] = 'not-a-uuid';

    await expect(h.guard.canActivate(h.context)).rejects.toMatchObject({ status: 401 });
    expect(h.prisma.person.findUnique).not.toHaveBeenCalled();
  });

  it('resolves the exact default fixture only when it is unambiguous', async () => {
    const h = fixture();
    h.request.headers = {};

    await expect(h.guard.canActivate(h.context)).resolves.toBe(true);
    expect(h.prisma.person.findMany).toHaveBeenCalledWith({
      where: { legalName: 'ADMIN TEST ROOT FIXTURE' },
      take: 2,
    });
  });

  it('fails closed outside the development entry point', async () => {
    const h = fixture();
    h.config.get.mockImplementation((key: string) => ({
      NODE_ENV: 'production',
      UCELL_ADMIN_DEV_FULL_ACCESS: 'true',
    })[key]);

    await expect(h.guard.canActivate(h.context)).rejects.toMatchObject({ status: 401 });
    expect(h.prisma.person.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['multiple Entra identity links', { identityLink: { findMany: jest.fn(async () => [{ providerSubject: subject }, { providerSubject: 'other' }]) } }],
    ['a blank Entra provider subject', { identityLink: { findMany: jest.fn(async () => [{ providerSubject: '   ' }]) } }],
    ['multiple active grants', { adminAccessGrant: { findMany: jest.fn(async () => [{ roleCode: 'SUPER_ADMIN' }, { roleCode: 'FINANCE' }]) } }],
    ['multiple active sessions', { authSession: { findMany: jest.fn(async () => [{ authSessionId: sessionId, roleCode: 'SUPER_ADMIN' }, { authSessionId: '33333333-3333-4333-8333-333333333333', roleCode: 'SUPER_ADMIN' }]) } }],
    ['a session with a different role', { authSession: { findMany: jest.fn(async () => [{ authSessionId: sessionId, roleCode: 'FINANCE' }]) } }],
  ])('fails closed for %s', async (_reason, overrides) => {
    const h = fixture(overrides);

    await expect(h.guard.canActivate(h.context)).rejects.toMatchObject({ status: 401 });
  });
});
