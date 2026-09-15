import { Module } from '@nestjs/common';
import { PayoutController } from './payout.controller';
import { UnifiedPayableService } from './unified-payable.service';
import { PayoutService } from './payout.service';
import { RecoveryBalanceService } from './recovery-balance.service';
@Module({controllers:[PayoutController],providers:[UnifiedPayableService,RecoveryBalanceService,PayoutService],exports:[UnifiedPayableService,RecoveryBalanceService]})
export class PayoutModule {}
