import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PackageConfigModule } from '../package-config/package-config.module';
import { QualificationModule } from '../qualification/qualification.module';
import { OrganizationModule } from '../organization/organization.module';
import { RetailReferrerAttributionService } from './retail-referrer-attribution.service';
import {PaperReceiptService} from './paper-receipt.service';
import {PaperReceiptController} from './paper-receipt.controller';
import {PaperIntakeController} from './paper-intake.controller';
import {PaperIntakeService} from './paper-intake.service';
import {PaperPersonIdentityService} from './paper-person-identity.service';
import { AdminRetailReferrerController } from './admin-retail-referrer.controller';

@Module({ imports:[PackageConfigModule,QualificationModule,OrganizationModule], controllers: [OrderController,AdminRetailReferrerController,PaperReceiptController,PaperIntakeController], providers: [OrderService,RetailReferrerAttributionService,PaperReceiptService,PaperIntakeService,PaperPersonIdentityService], exports:[OrderService,RetailReferrerAttributionService] })
export class OrderModule {}

