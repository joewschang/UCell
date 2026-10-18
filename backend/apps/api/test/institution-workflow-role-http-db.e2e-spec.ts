import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService } from '@ucell/database';
import { randomUUID } from 'node:crypto';
import { IdentityTokenService } from '../src/modules/auth/identity-token.service';
import { QualificationWorkflowService } from '../src/modules/qualification/qualification-workflow.service';
import { RequestContextInterceptor } from '../src/common/interceptors/request-context.interceptor';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
const url = process.env.PHASE2_TEST_DATABASE_URL;
if (!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))) throw Error('ISOLATED_DATABASE_REQUIRED');
describe('Institution workflow write HTTP role matrix', () => {
  const db = new PrismaService();
  const commands = { submit: jest.fn(async () => ({ accepted: true })), approve: jest.fn(async () => ({ accepted: true })) };
  const tokens = new Map<string, string>();
  let app: NestFastifyApplication;
  const roles = ['SUPER_ADMIN', 'MEMBERSHIP_OPS', 'COMPLIANCE_AUDIT', 'FINANCE', 'ORDER_OPS', 'CUSTOMER_SERVICE', 'ANONYMOUS'];
  beforeAll(async () => {
    process.env.ADMIN_AUTH_BYPASS = 'false';
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(db)
      .overrideProvider(QualificationWorkflowService).useValue(commands).compile();
    module.get(ConfigService).set('ADMIN_AUTH_BYPASS', 'false');
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api/v1'); app.useGlobalInterceptors(new RequestContextInterceptor()); app.useGlobalFilters(new ApiExceptionFilter());
    await app.init(); await app.getHttpAdapter().getInstance().ready();
    for (const roleCode of roles.filter(r => r !== 'ANONYMOUS')) {
      const person = await db.person.create({ data: { legalName: 'SYNTHETIC WORKFLOW ROLE ' + roleCode } }), subject = randomUUID();
      await db.identityLink.create({ data: { personId: person.personId, provider: 'ENTRA', providerSubject: subject } });
      await db.adminAccessGrant.create({ data: { personId: person.personId, provider: 'ENTRA', providerSubject: subject, roleCode, validFrom: new Date(Date.now() - 1000) } });
      tokens.set(roleCode, (await new IdentityTokenService(db).issue({ personId: person.personId, provider: 'ENTRA', subject, roleCode })).accessToken);
    }
  }, 120000);
  afterAll(async () => { await app?.close(); await db.$disconnect(); });
  it.each(roles.flatMap(role => ['submit', 'approve'].map(operation => ({ role, operation }))))('$role / $operation obeys write permissions', async ({ role, operation }) => {
    jest.clearAllMocks();
    const allowed = ['SUPER_ADMIN', 'MEMBERSHIP_OPS'].includes(role);
    const result = await app.inject({ method: 'POST', url: '/api/v1/admin/qualification-workflows' + (operation === 'approve' ? '/' + randomUUID() + '/approve' : ''),
      headers: tokens.has(role) ? { authorization: 'Bearer ' + tokens.get(role) } : {}, payload: {} });
    expect(result.statusCode).toBe(allowed ? 201 : role === 'ANONYMOUS' ? 401 : 403);
    expect(commands[operation as 'submit' | 'approve']).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });
});
