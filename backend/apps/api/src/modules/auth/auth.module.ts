import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { EntraTokenVerifierService } from './entra-token-verifier.service';
import { QualificationAccessService } from './qualification-access.service';
import { AdminRoleGuard } from './admin-role.guard';
import { IdentityTokenService } from './identity-token.service';
import { LineIdentityService } from './line-identity.service';
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
import { AuditModule } from '../../common/audit/audit.module';
import { AccountSecurityService } from './account-security.service';
import { AccountSecurityController } from './account-security.controller';
import { LineMessagingAdapter } from './line-messaging.adapter';
import { LineMessagingIngressService } from './line-messaging-ingress.service';
import { LineMessagingWebhookController } from './line-messaging-webhook.controller';
import { PaymentHubModule } from '../payment-hub/payment-hub.module';
import { NotificationDeliveryService } from './notification-delivery.service';
@Module({
  imports:[AuditModule,PaymentHubModule],
  controllers:[AdminAuthController,OtpController,NetworkRegistrationController,AccountSecurityController,LineMessagingWebhookController],
  providers:[QualificationAccessService,AdminRoleGuard,IdentityTokenService,LineIdentityService,AuthenticationGuard,MemberAuthenticationGuard,AdminAuthenticationGuard,EntraTokenVerifierService,AdminAuthService,OtpService,OtpCodeService,SmsOtpProviderService,NetworkRegistrationService,AccountSecurityService,LineMessagingAdapter,LineMessagingIngressService,NotificationDeliveryService],
  exports:[QualificationAccessService,AdminRoleGuard,IdentityTokenService,LineIdentityService,AuthenticationGuard,MemberAuthenticationGuard,AdminAuthenticationGuard,EntraTokenVerifierService,AdminAuthService,AccountSecurityService]
})
export class AuthModule {}
