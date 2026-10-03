import {MemberPayoutController} from './member-payout.controller';
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
import { IdentityMatchFingerprintService } from '../../common/security/identity-match-fingerprint.service';
import { MemberReferralAttributionController, ReferralAttributionController } from './referral-attribution.controller';
import { ReferralAttributionService } from './referral-attribution.service';
import { FormalMemberApplicationService } from './formal-member-application.service';
import { AdminFormalMemberApplicationController } from './admin-formal-member-application.controller';
import { FormalMembershipConflictService } from './formal-membership-conflict.service';
import { FormalKycStorageService } from './formal-kyc-storage.service';
import { FormalKycDocumentService } from './formal-kyc-document.service';
import { MemberRetailReferrerController } from './member-retail-referrer.controller';
import {MemberGrowthService} from './member-growth.service';
import {FormalEnrollmentService} from './formal-enrollment.service';
import {FormalEnrollmentController} from './formal-enrollment.controller';
@Module({
 imports:[AuthModule,OrderModule],
 controllers:[FormalEnrollmentController,MemberExplainController,MemberAuthController,MemberController,ReferralAttributionController,MemberReferralAttributionController,AdminFormalMemberApplicationController,MemberPayoutController,MemberMessagesController,MemberRetailReferrerController],
 providers:[FormalEnrollmentService,MemberExplainService,MemberService,MemberReadService,MemberTreeReadService,MemberShareLinkService,ReferralAttributionService,FormalMemberApplicationService,FormalMembershipConflictService,FormalKycStorageService,FormalKycDocumentService,MemberContractService,DeliveryProfileService,PiiCryptoService,IdentityMatchFingerprintService,MemberContextGuard,LineTokenVerifierService,MemberMessagesService,IdempotencyService,MemberGrowthService]
})
export class MemberModule {}
