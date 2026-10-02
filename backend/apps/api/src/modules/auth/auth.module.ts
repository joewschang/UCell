import { LineStageWebhookController } from './line-stage-webhook.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { EntraTokenVerifierService } from './entra-token-verifier.service';
import { QualificationAccessService } from './qualification-access.service';
import { AdminRoleGuard } from './admin-role.guard';
import { IdentityTokenService } from './identity-token.service';
import { LineIdentityService } from './line-identity.service';
import { MemberIdentityService } from './member-identity.service';
import { AuthenticationGuard } from './authentication.guard';
import { MemberAuthenticationGuard } from './member-authentication.guard';
import { Module } from '@nestjs/common';
import { AdminAuthenticationGuard } from './admin-authentication.guard';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { OtpCodeService } from './otp-code.service';
import { SmsOtpProviderService } from './sms-otp-provider.service';
import { NetworkRegistrationController } from './network-registration.controller';
import { NetworkRegistrationService } from './network-registration.service';
import { PiiCryptoService } from '../../common/security/pii-crypto.service';
import { IdentityMatchFingerprintService } from '../../common/security/identity-match-fingerprint.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { PasswordResetEmailService } from './password-reset-email.service';
import { MemberWebAuthService } from './member-web-auth.service';
import { MemberWebAuthController } from './member-web-auth.controller';
import { MemberWebRegistrationService } from './member-web-registration.service';
import { MemberWebRegistrationController } from './member-web-registration.controller';
import { MemberIdentityLinkController } from './member-identity-link.controller';
import { AuditModule } from '../../common/audit/audit.module';
import { AccountSecurityService } from './account-security.service';
import { AccountSecurityController } from './account-security.controller';
import { LineMessagingAdapter } from './line-messaging.adapter';
import { LineMessagingIngressService } from './line-messaging-ingress.service';
import { LineMessagingWebhookController } from './line-messaging-webhook.controller';
import { PaymentHubModule } from '../payment-hub/payment-hub.module';
import { NotificationDeliveryService } from './notification-delivery.service';
import { LineIntegrationStatusService } from './line-integration-status.service';
import { LineIntegrationStatusController } from './line-integration-status.controller';
import { ExistingMemberLineLinkController,AdminExistingMemberLineLinkController } from './existing-member-line-link.controller';
import { ExistingMemberLineLinkService } from './existing-member-line-link.service';
import { LineTokenVerifierService } from './line-token-verifier.service';
@Module({
 imports:[AuditModule,PaymentHubModule],
 controllers:[AdminAuthController,OtpController,NetworkRegistrationController,MemberWebAuthController,MemberWebRegistrationController,MemberIdentityLinkController,LineStageWebhookController,AccountSecurityController,LineMessagingWebhookController,LineIntegrationStatusController,ExistingMemberLineLinkController,AdminExistingMemberLineLinkController],
 providers:[QualificationAccessService,AdminRoleGuard,IdentityTokenService,LineIdentityService,MemberIdentityService,GoogleTokenVerifierService,PasswordResetEmailService,MemberWebAuthService,MemberWebRegistrationService,AuthenticationGuard,MemberAuthenticationGuard,AdminAuthenticationGuard,EntraTokenVerifierService,AdminAuthService,OtpService,OtpCodeService,SmsOtpProviderService,NetworkRegistrationService,PiiCryptoService,IdentityMatchFingerprintService,AccountSecurityService,LineMessagingAdapter,LineMessagingIngressService,NotificationDeliveryService,LineIntegrationStatusService,ExistingMemberLineLinkService,LineTokenVerifierService],
 exports:[QualificationAccessService,AdminRoleGuard,IdentityTokenService,LineIdentityService,MemberIdentityService,AuthenticationGuard,MemberAuthenticationGuard,AdminAuthenticationGuard,EntraTokenVerifierService,AdminAuthService,AccountSecurityService]
})
export class AuthModule {}
