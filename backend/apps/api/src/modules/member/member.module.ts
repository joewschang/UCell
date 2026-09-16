import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderModule } from '../order/order.module';
import { LineTokenVerifierService } from '../auth/line-token-verifier.service';
import { MemberService } from './member.service';
import { MemberShareLinkService } from './member-share-link.service';
import { MemberContractService } from './member-contract.service';
import { MemberReadService } from './member-read.service';
import { MemberContextGuard } from './member-context.guard';
import { MemberAuthController, MemberController } from './member.controller';
@Module({imports:[AuthModule,OrderModule],controllers:[MemberAuthController,MemberController],providers:[MemberService,MemberReadService,MemberShareLinkService,MemberContractService,MemberContextGuard,LineTokenVerifierService]})
export class MemberModule {}
