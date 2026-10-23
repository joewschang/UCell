import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {IdempotencyModule} from '../../common/idempotency/idempotency.module';
import {MarketingService} from './marketing.service';
import {AdminMarketingController,MemberMarketingController} from './marketing.controller';
@Module({imports:[AuthModule,IdempotencyModule],providers:[MarketingService],controllers:[AdminMarketingController,MemberMarketingController]})
export class MarketingModule{}
