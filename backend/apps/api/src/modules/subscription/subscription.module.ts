import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionCalendarService } from './subscription-calendar.service';
import { SubscriptionCancellationService } from './subscription-cancellation.service';
import { RpvReversalService } from './rpv-reversal.service';

@Module({controllers:[SubscriptionController],providers:[SubscriptionService,SubscriptionCalendarService,SubscriptionCancellationService,RpvReversalService],exports:[SubscriptionService,SubscriptionCancellationService,RpvReversalService]})
export class SubscriptionModule {}
