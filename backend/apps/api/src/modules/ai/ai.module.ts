import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {AiService} from './ai.service';
import {AiData} from './ai-data';
import {AiProvider} from './ai-provider';
import {AdminAiController,MemberAiController} from './ai.controller';
@Module({imports:[AuthModule],providers:[AiService,AiData,AiProvider],controllers:[AdminAiController,MemberAiController]})
export class AiModule{}
