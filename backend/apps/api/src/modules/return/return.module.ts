import { EpvModule } from '../epv/epv.module';
import { Module } from '@nestjs/common';
import { ReturnController } from './return.controller';
import { ReturnService } from './return.service';
import { ReversalService } from './reversal.service';
import { SettlementModule } from '../settlement/settlement.module';

@Module({
  imports:[SettlementModule,EpvModule],
  controllers:[ReturnController],
  providers:[ReturnService,ReversalService],
  exports:[ReversalService]
})
export class ReturnModule {}
