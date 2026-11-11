import {DailyGreetingScheduler} from './daily-greeting.scheduler';
import {Module} from '@nestjs/common';
import {DailyGreetingController} from './daily-greeting.controller';
import {DailyGreetingService} from './daily-greeting.service';
@Module({controllers:[DailyGreetingController],providers:[DailyGreetingService,DailyGreetingScheduler]})
export class DailyGreetingModule {}
