import {MemberMessagesController} from './member-messages.controller';
import {MemberMessagesService} from './member-messages.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import { MemberExplainController } from './member-explain.controller';
import { MemberExplainService } from './member-explain.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderModule } from '../order/order.module';
import { LineTokenVerifierService } from '../auth/line-token-verifier.service';
import { MemberService } from './member.service';
import { MemberShareLinkService } from './member-share-link.service';
import { MemberContractService } from './member-contract.service';
import { MemberReadService } from './member-read.service';
import { MemberTreeReadService } from './member-tree-read.service';
import { MemberContextGuard } from './member-context.guard';
import { MemberAuthController, MemberController } from './member.controller';
import { DeliveryProfileService } from './delivery-profile.service';
import { PiiCryptoService } from '../../common/security/pii-crypto.service';
import { MemberReferralAttributionController, ReferralAttributionController } from './referral-attribution.controller';
import { ReferralAttributionService } from './referral-attribution.service';
import { FormalMemberApplicationService } from './formal-member-application.service';
import { AdminFormalMemberApplicationController } from './admin-formal-member-application.controller';
import { MemberRetailReferrerController } from './member-retail-referrer.controller';
import {MemberGrowthService} from './member-growth.service';
@Module({imports:[AuthModule,OrderModule],controllers:[MemberMessagesController,MemberExplainController,MemberAuthController,MemberController,ReferralAttributionController,MemberReferralAttributionController,AdminFormalMemberApplicationController,MemberRetailReferrerController],providers:[MemberMessagesService,IdempotencyService,MemberExplainService,MemberService,MemberReadService,MemberTreeReadService,MemberShareLinkService,ReferralAttributionService,FormalMemberApplicationService,MemberContractService,DeliveryProfileService,MemberGrowthService,PiiCryptoService,MemberContextGuard,LineTokenVerifierService]})
export class MemberModule {}
