import {Module} from '@nestjs/common';
import {DailyGreetingController} from './daily-greeting.controller';
import {DailyGreetingService} from './daily-greeting.service';
@Module({controllers:[DailyGreetingController],providers:[DailyGreetingService]})
export class DailyGreetingModule {}
