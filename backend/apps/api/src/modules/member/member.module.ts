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
import { DeliveryProfileService } from './delivery-profile.service';
import { PiiCryptoService } from '../../common/security/pii-crypto.service';
import { MemberReferralAttributionController, ReferralAttributionController } from './referral-attribution.controller';
import { ReferralAttributionService } from './referral-attribution.service';
import { FormalMemberApplicationService } from './formal-member-application.service';
@Module({imports:[AuthModule,OrderModule],controllers:[MemberAuthController,MemberController,ReferralAttributionController,MemberReferralAttributionController],providers:[MemberService,MemberReadService,MemberShareLinkService,ReferralAttributionService,FormalMemberApplicationService,MemberContractService,DeliveryProfileService,PiiCryptoService,MemberContextGuard,LineTokenVerifierService]})
export class MemberModule {}
