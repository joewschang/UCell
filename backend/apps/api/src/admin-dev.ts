import 'reflect-metadata';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BinaryTreeModule } from './modules/binary-tree/binary-tree.module';
import { ContentModule } from './modules/content/content.module';
import { ExplainModule } from './modules/explain/explain.module';
import { MemberModule } from './modules/member/member.module';
import { PackageConfigModule } from './modules/package-config/package-config.module';
import { ReservoirModule } from './modules/reservoir/reservoir.module';
import { Module, CanActivate, ExecutionContext, Injectable, MethodNotAllowedException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DatabaseModule, PrismaService } from '@ucell/database';
import { AuditModule } from './common/audit/audit.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { HealthModule } from './modules/health/health.module';
import { PersonModule } from './modules/person/person.module';
import { ProductModule } from './modules/product/product.module';
import { QualificationModule } from './modules/qualification/qualification.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { OrderModule } from './modules/order/order.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { ActiveModule } from './modules/active/active.module';
import { RpvModule } from './modules/rpv/rpv.module';
import { RuntimeRuleModule } from './modules/rules/runtime-rule.module';
import { BonusModule } from './modules/bonus/bonus.module';
import { ReturnModule } from './modules/return/return.module';
import { EpvModule } from './modules/epv/epv.module';
import { GlobalPoolModule } from './modules/global-pool/global-pool.module';
import { PayoutModule } from './modules/payout/payout.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { AdjustmentModule } from './modules/adjustment/adjustment.module';
import { MembershipApplicationModule } from './modules/application/membership-application.module';
import { AdminDashboardModule } from './modules/admin-dashboard/admin-dashboard.module';
import { AdminObservabilityModule } from './modules/admin-observability/admin-observability.module';
import { AdminOperationsModule } from './modules/admin-operations/admin-operations.module';
import { AdminOpsReadyModule } from './modules/admin-ops-ready/admin-ops-ready.module';
import { AdminProviderOperationsModule } from './modules/admin-provider-operations/admin-provider-operations.module';
import { UatEvidenceModule } from './modules/uat-evidence/uat-evidence.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminAuthenticationGuard } from './modules/auth/admin-authentication.guard';
import { AdminRoleGuard } from './modules/auth/admin-role.guard';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

@Injectable()
export class AdminDevReadOnlyGuard implements CanActivate {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  /**
   * The full-access DEV entry point is restricted to the isolated test database
   * at bootstrap.  It still has to exercise the same Entra/session/grant
   * boundary used by sensitive tree operations, instead of manufacturing an
   * ADMIN_LOCAL principal here.
   */
  private async resolveIsolatedEntraPrincipal(actorId: unknown) {
    if (this.config.get('NODE_ENV') !== 'development') {
      throw new UnauthorizedException('ADMIN_TEST_ACTOR_INVALID');
    }
    let selectedActorId: string | undefined;
    if (actorId !== undefined) {
      if (typeof actorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId)) {
        throw new UnauthorizedException('ADMIN_TEST_ACTOR_INVALID');
      }
      selectedActorId = actorId;
    }

    let people;
    if (selectedActorId) {
      const person = await this.prisma.person.findUnique({ where: { personId: selectedActorId } });
      people = person ? [person] : [];
    } else {
      people = await this.prisma.person.findMany({ where: { legalName: 'ADMIN TEST ROOT FIXTURE' }, take: 2 });
    }
    if (people.length !== 1 || !people[0]) {
      throw new UnauthorizedException('ADMIN_TEST_ACTOR_REQUIRED');
    }

    const person = people[0];
    const now = new Date();
    const links = await this.prisma.identityLink.findMany({
      where: { personId: person.personId, provider: 'ENTRA' },
      select: { providerSubject: true },
      take: 2,
    });
    if (links.length !== 1 || !links[0]) {
      throw new UnauthorizedException('ADMIN_TEST_ACTOR_ENTRA_IDENTITY_REQUIRED');
    }

    const subject = links[0].providerSubject;
    if (typeof subject !== 'string' || subject.trim().length === 0) {
      throw new UnauthorizedException('ADMIN_TEST_ACTOR_ENTRA_IDENTITY_REQUIRED');
    }
    const grants = await this.prisma.adminAccessGrant.findMany({
      where: {
        personId: person.personId,
        provider: 'ENTRA',
        providerSubject: subject,
        status: 'ACTIVE',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { roleCode: true },
      take: 2,
    });
    if (grants.length !== 1 || !grants[0]) {
      throw new UnauthorizedException('ADMIN_TEST_ACTOR_ENTRA_GRANT_REQUIRED');
    }

    const role = grants[0].roleCode;
    const sessions = await this.prisma.authSession.findMany({
      where: {
        personId: person.personId,
        provider: 'ENTRA',
        subject,
        status: 'ACTIVE',
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { authSessionId: true, roleCode: true },
      take: 2,
    });
    if (sessions.length !== 1 || !sessions[0] || sessions[0].roleCode !== role) {
      throw new UnauthorizedException('ADMIN_TEST_ACTOR_ENTRA_SESSION_REQUIRED');
    }

    return {
      sessionId: sessions[0].authSessionId,
      personId: person.personId,
      provider: 'ENTRA' as const,
      subject,
      role,
    };
  }

  async canActivate(context: ExecutionContext) {
    const path=context.switchToHttp().getRequest().url?.split('?')[0]??'';
    if(path==='/api/v1/member'||path.startsWith('/api/v1/member/')||path.startsWith('/api/v1/auth/member/'))return true;
    if (this.config.get('UCELL_ADMIN_DEV_FULL_ACCESS') === 'true') {
      const req=context.switchToHttp().getRequest();
      const id=req.headers['x-ucell-dev-actor-id'];
      req.user=await this.resolveIsolatedEntraPrincipal(id);
      return true;
    }
    const method = context.switchToHttp().getRequest().method;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      throw new MethodNotAllowedException('ADMIN_DEV_READ_ONLY: write operations are unavailable');
    }
    return true;
  }
}

// Separate DEV entrypoint; the production AppModule/build/release gates are unchanged.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), DatabaseModule,
    BinaryTreeModule, ContentModule, ExplainModule, PackageConfigModule, ReservoirModule,
    AuditModule, IdempotencyModule, OutboxModule, AuthModule, HealthModule, MemberModule,
    PersonModule, ProductModule, OrganizationModule, QualificationModule, OrderModule,
    LedgerModule, ActiveModule, RpvModule, RuntimeRuleModule, BonusModule, ReturnModule,
    EpvModule, GlobalPoolModule, PayoutModule, SettlementModule, AdjustmentModule,
    SubscriptionModule, MembershipApplicationModule, AdminDashboardModule, AdminObservabilityModule,
    AdminOperationsModule, AdminOpsReadyModule, AdminProviderOperationsModule, UatEvidenceModule, AnalyticsModule],
  providers: [{ provide: APP_GUARD, useClass: AdminDevReadOnlyGuard },
    { provide: APP_GUARD, useClass: AdminAuthenticationGuard },
    { provide: APP_GUARD, useClass: AdminRoleGuard }],
})
class AdminDevModule {}

async function bootstrap() {
  const fullAccess = process.env.UCELL_ADMIN_DEV_FULL_ACCESS === 'true';
  if (process.env.NODE_ENV !== 'development' || process.env.ADMIN_AUTH_BYPASS !== 'true'
      || (!fullAccess && process.env.UCELL_ADMIN_DEV_READ_ONLY !== 'true')) {
    throw new Error('ADMIN_DEV_START_BLOCKED: explicit development/read-only/demo configuration required');
  }
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('ADMIN_DEV_START_BLOCKED: local DEV database required');
  }
  if (fullAccess && url.pathname !== '/ucell_admin_test') {
    throw new Error('ADMIN_DEV_START_BLOCKED: full access requires isolated ucell_admin_test database');
  }
  const app = await NestFactory.create<NestFastifyApplication>(AdminDevModule, new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new RequestContextInterceptor(), new EnvelopeInterceptor());
  await app.listen(3001, '127.0.0.1');
  console.log(`${fullAccess?'ADMIN_DEV_FULL_TEST':'ADMIN_DEV_READ_ONLY'}: http://127.0.0.1:3001/api/v1 — ${fullAccess?'isolated DB; dependency replay guarded by configuration and decisions':'all writes blocked'}`);
}

if (require.main === module) bootstrap().catch(error => { console.error(error); process.exitCode = 1; });
