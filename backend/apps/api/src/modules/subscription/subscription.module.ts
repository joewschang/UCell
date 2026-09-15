import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionCancellationService } from './subscription-cancellation.service';
import { RpvReversalService } from './rpv-reversal.service';

@Module({controllers:[SubscriptionController],providers:[SubscriptionService,SubscriptionCancellationService,RpvReversalService],exports:[SubscriptionService,SubscriptionCancellationService,RpvReversalService]})
export class SubscriptionModule {}
