import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { EntraTokenVerifierService } from './entra-token-verifier.service';
import { QualificationAccessService } from './qualification-access.service';
import { AdminRoleGuard } from './admin-role.guard';
import { IdentityTokenService } from './identity-token.service';
import { LineIdentityService } from './line-identity.service';
import { AuthenticationGuard } from './authentication.guard';
import { Module } from '@nestjs/common';
import { AdminAuthenticationGuard } from './admin-authentication.guard';
@Module({
  controllers:[AdminAuthController],
  providers:[QualificationAccessService,AdminRoleGuard,IdentityTokenService,LineIdentityService,AuthenticationGuard,AdminAuthenticationGuard,EntraTokenVerifierService,AdminAuthService],
  exports:[QualificationAccessService,AdminRoleGuard,IdentityTokenService,LineIdentityService,AuthenticationGuard,AdminAuthenticationGuard,EntraTokenVerifierService,AdminAuthService]
})
export class AuthModule {}
