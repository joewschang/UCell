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
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { PasswordResetEmailService } from './password-reset-email.service';
import { MemberWebAuthService } from './member-web-auth.service';
import { MemberWebAuthController } from './member-web-auth.controller';
import { MemberOtpAuthService } from './member-otp-auth.service';
import { MemberOtpAuthController } from './member-otp-auth.controller';
import { MemberWebRegistrationService } from './member-web-registration.service';
import { MemberWebRegistrationController } from './member-web-registration.controller';
import { MemberIdentityLinkController } from './member-identity-link.controller';
@Module({
  controllers:[AdminAuthController,OtpController,NetworkRegistrationController,MemberWebAuthController,MemberOtpAuthController,MemberWebRegistrationController,MemberIdentityLinkController],
  providers:[QualificationAccessService,AdminRoleGuard,IdentityTokenService,LineIdentityService,MemberIdentityService,GoogleTokenVerifierService,PasswordResetEmailService,MemberWebAuthService,MemberOtpAuthService,MemberWebRegistrationService,AuthenticationGuard,MemberAuthenticationGuard,AdminAuthenticationGuard,EntraTokenVerifierService,AdminAuthService,OtpService,OtpCodeService,SmsOtpProviderService,NetworkRegistrationService],
  exports:[QualificationAccessService,AdminRoleGuard,IdentityTokenService,LineIdentityService,MemberIdentityService,AuthenticationGuard,MemberAuthenticationGuard,AdminAuthenticationGuard,EntraTokenVerifierService,AdminAuthService]
})
export class AuthModule {}
