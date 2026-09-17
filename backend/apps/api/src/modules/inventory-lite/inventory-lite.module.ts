import { Module } from '@nestjs/common';
import { DatabaseModule } from '@ucell/database';
import { InventoryPersistenceService } from './inventory-persistence.service';

@Module({
  imports: [DatabaseModule],
  providers: [InventoryPersistenceService],
  exports: [InventoryPersistenceService],
})
export class InventoryLiteModule {}
