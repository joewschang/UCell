import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LineTokenVerifierService } from '../auth/line-token-verifier.service';
import { MemberService } from './member.service';
import { MemberAuthController, MemberController } from './member.controller';
@Module({imports:[AuthModule],controllers:[MemberAuthController,MemberController],providers:[MemberService,LineTokenVerifierService]})
export class MemberModule {}
