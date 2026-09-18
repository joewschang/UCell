import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MemberContextGuard } from '../member/member-context.guard';
import { MemberStructuredExplainController } from './member-structured-explain.controller';
import { MemberStructuredExplainService } from './member-structured-explain.service';
import { AdminStructuredExplainController } from './admin-structured-explain.controller';
import { AdminStructuredExplainService } from './admin-structured-explain.service';
@Module({imports:[AuthModule],controllers:[MemberStructuredExplainController,AdminStructuredExplainController],
 providers:[MemberStructuredExplainService,AdminStructuredExplainService,MemberContextGuard]})
export class ExplainModule {}
