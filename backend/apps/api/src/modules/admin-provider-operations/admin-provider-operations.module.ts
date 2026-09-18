import { Module } from '@nestjs/common';
import { AdminProviderOperationsController } from './admin-provider-operations.controller';
import { AdminProviderOperationsService } from './admin-provider-operations.service';
import { AdminProviderReconciliationController } from './admin-provider-reconciliation.controller';

@Module({controllers:[AdminProviderOperationsController,AdminProviderReconciliationController],providers:[AdminProviderOperationsService]})
export class AdminProviderOperationsModule{}
