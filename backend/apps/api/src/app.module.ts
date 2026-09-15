import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
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
import { LedgerModule } from './modules/ledger/ledger.module';
import { RpvModule } from './modules/rpv/rpv.module';
import { BonusModule } from './modules/bonus/bonus.module';
import { PayoutModule } from './modules/payout/payout.module';
import { GlobalPoolModule } from './modules/global-pool/global-pool.module';
import { EpvModule } from './modules/epv/epv.module';
import { ReturnModule } from './modules/return/return.module';
import { RuntimeRuleModule } from './modules/rules/runtime-rule.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { ActiveModule } from './modules/active/active.module';
import { MembershipApplicationModule } from './modules/application/membership-application.module';
import { AdjustmentModule } from './modules/adjustment/adjustment.module';
import { AuthModule } from './modules/auth/auth.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { AdminDashboardModule } from './modules/admin-dashboard/admin-dashboard.module';
import { AdminObservabilityModule } from './modules/admin-observability/admin-observability.module';
import { AdminOperationsModule } from './modules/admin-operations/admin-operations.module';
import { AdminOpsReadyModule } from './modules/admin-ops-ready/admin-ops-ready.module';
import { AdminAuthenticationGuard } from './modules/auth/admin-authentication.guard';
import { AdminRoleGuard } from './modules/auth/admin-role.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditModule,
    IdempotencyModule,
    OutboxModule,
    HealthModule,
    AdminDashboardModule,
    AdminObservabilityModule,
    AdminOperationsModule,
    AdminOpsReadyModule,
    PersonModule,
    ProductModule,
    OrganizationModule,
    QualificationModule,
    OrderModule,
    LedgerModule,
    MembershipApplicationModule,
    ActiveModule,
    SubscriptionModule,
    RpvModule,
    RuntimeRuleModule,
    BonusModule,
    ReturnModule,
    EpvModule,
    GlobalPoolModule,
    PayoutModule,
    SettlementModule,
    AuthModule,
    AdjustmentModule,
  ],
  providers:[
    {provide:APP_GUARD,useClass:AdminAuthenticationGuard},
    {provide:APP_GUARD,useClass:AdminRoleGuard},
  ],
})
export class AppModule {}
