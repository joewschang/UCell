import { Module } from '@nestjs/common';
import { SettlementAdjustmentController } from './settlement-adjustment.controller';
import { SettlementAdjustmentService } from './settlement-adjustment.service';
import { SettlementReplayService } from './settlement-replay.service';
import { CarryChainReplayService } from './carry-chain-replay.service';
import { CarryChainReplayController } from './carry-chain-replay.controller';

@Module({
  controllers:[SettlementAdjustmentController,CarryChainReplayController],
  providers:[SettlementAdjustmentService,SettlementReplayService,CarryChainReplayService]
})
export class AdjustmentModule {}
