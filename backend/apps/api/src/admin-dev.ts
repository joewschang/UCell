import 'reflect-metadata';
import { MemberModule } from './modules/member/member.module';
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
import { AuthModule } from './modules/auth/auth.module';
import { AdminAuthenticationGuard } from './modules/auth/admin-authentication.guard';
import { AdminRoleGuard } from './modules/auth/admin-role.guard';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

@Injectable()
export class AdminDevReadOnlyGuard implements CanActivate {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const path=context.switchToHttp().getRequest().url?.split('?')[0]??'';
    if(path==='/api/v1/member'||path.startsWith('/api/v1/member/')||path.startsWith('/api/v1/auth/member/'))return true;
    if (this.config.get('UCELL_ADMIN_DEV_FULL_ACCESS') === 'true') {
      const req=context.switchToHttp().getRequest();
      const id=req.headers['x-ucell-dev-actor-id'];
      if(id && (typeof id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))
        throw new UnauthorizedException('ADMIN_TEST_ACTOR_INVALID');
      const actor=id ? await this.prisma.person.findUnique({where:{personId:id}})
        : await this.prisma.person.findFirst({where:{legalName:'ADMIN TEST ROOT FIXTURE'}});
      if(!actor) throw new UnauthorizedException('ADMIN_TEST_ACTOR_REQUIRED: provision a test Person first');
      req.user={sessionId:'ISOLATED_DEV_TEST',personId:actor.personId,provider:'ADMIN_LOCAL',subject:'isolated-dev-test',role:'SUPER_ADMIN'};
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
    AuditModule, IdempotencyModule, OutboxModule, AuthModule, HealthModule, MemberModule,
    PersonModule, ProductModule, OrganizationModule, QualificationModule, OrderModule,
    LedgerModule, ActiveModule, RpvModule, RuntimeRuleModule, BonusModule, ReturnModule,
    EpvModule, GlobalPoolModule, PayoutModule, SettlementModule, AdjustmentModule,
    SubscriptionModule, MembershipApplicationModule, AdminDashboardModule, AdminObservabilityModule,
    AdminOperationsModule, AdminOpsReadyModule],
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
