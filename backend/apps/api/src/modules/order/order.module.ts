import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PackageConfigModule } from '../package-config/package-config.module';
import { QualificationModule } from '../qualification/qualification.module';
import { OrganizationModule } from '../organization/organization.module';
import { RetailReferrerAttributionService } from './retail-referrer-attribution.service';

@Module({ imports:[PackageConfigModule,QualificationModule,OrganizationModule], controllers: [OrderController], providers: [OrderService,RetailReferrerAttributionService], exports:[OrderService,RetailReferrerAttributionService] })
export class OrderModule {}
