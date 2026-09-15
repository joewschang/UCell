import { Module } from '@nestjs/common';
import { ReturnController } from './return.controller';
import { ReturnService } from './return.service';
import { ReversalService } from './reversal.service';
import { SettlementModule } from '../settlement/settlement.module';

@Module({
  imports:[SettlementModule],
  controllers:[ReturnController],
  providers:[ReturnService,ReversalService],
  exports:[ReversalService]
})
export class ReturnModule {}
