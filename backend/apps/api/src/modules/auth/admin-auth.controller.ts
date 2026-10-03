import { Body,Controller,Get,Post,Req,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiTags } from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AuthenticationGuard } from './authentication.guard';

@ApiTags('Admin - Authentication')
@Controller('auth/admin')
export class AdminAuthController{
  constructor(private readonly service:AdminAuthService){}

  @Post('entra/exchange')
  @ApiOperation({operationId:'adminEntraExchange',summary:'驗證Microsoft Entra ID Token並交換UCell短效Backend Session'})
  exchange(@Body() body:{idToken:string}){
    return this.service.exchangeEntra(body.idToken).then(data=>({data}));
  }

  @Get('me')
  @ApiBearerAuth('adminBearer')
  @UseGuards(AuthenticationGuard)
  @ApiOperation({operationId:'adminMe',summary:'目前Admin Session'})
  me(@Req() req:any){return this.service.me(req.user.sessionId).then(data=>({data}));}

  @Post('logout')
  @ApiBearerAuth('adminBearer')
  @UseGuards(AuthenticationGuard)
  @ApiOperation({operationId:'adminLogout',summary:'撤銷目前Admin Session'})
  logout(@Req() req:any){return this.service.logout(req.user.sessionId,req.requestId,req.correlationId).then(()=>({data:{ok:true}}));}
}
