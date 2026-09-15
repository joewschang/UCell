import 'reflect-metadata';
import { Module, CanActivate, ExecutionContext, Injectable, MethodNotAllowedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DatabaseModule } from '@ucell/database';
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
  canActivate(context: ExecutionContext) {
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
    AuditModule, IdempotencyModule, OutboxModule, AuthModule, HealthModule,
    PersonModule, ProductModule, OrganizationModule, QualificationModule, OrderModule,
    SubscriptionModule, MembershipApplicationModule, AdminDashboardModule, AdminObservabilityModule,
    AdminOperationsModule, AdminOpsReadyModule],
  providers: [{ provide: APP_GUARD, useClass: AdminDevReadOnlyGuard },
    { provide: APP_GUARD, useClass: AdminAuthenticationGuard },
    { provide: APP_GUARD, useClass: AdminRoleGuard }],
})
class AdminDevModule {}

async function bootstrap() {
  if (process.env.NODE_ENV !== 'development' || process.env.ADMIN_AUTH_BYPASS !== 'true'
      || process.env.UCELL_ADMIN_DEV_READ_ONLY !== 'true') {
    throw new Error('ADMIN_DEV_START_BLOCKED: explicit development/read-only/demo configuration required');
  }
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('ADMIN_DEV_START_BLOCKED: local DEV database required');
  }
  const app = await NestFactory.create<NestFastifyApplication>(AdminDevModule, new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new RequestContextInterceptor(), new EnvelopeInterceptor());
  await app.listen(3001, '127.0.0.1');
  console.log('ADMIN_DEV_READ_ONLY: http://127.0.0.1:3001/api/v1 — all writes blocked');
}

if (require.main === module) bootstrap().catch(error => { console.error(error); process.exitCode = 1; });
