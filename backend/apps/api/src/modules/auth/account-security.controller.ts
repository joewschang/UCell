import { Body, Controller, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { Roles } from './roles.decorator';
import { AccountSecurityService } from './account-security.service';

class AccountSecurityReasonDto {
  @IsString() @MinLength(2) @MaxLength(120) reasonCode!:string;
}
class LineRebindRequestDto {
  @IsString() @MinLength(8) @MaxLength(160) verificationReference!:string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) reasonCode?:string;
}

@ApiTags('Admin - Account Security')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','CUSTOMER_SERVICE')
@Controller('admin/persons/:personId/account-security')
export class AccountSecurityController {
  constructor(private readonly service:AccountSecurityService){}

  @Post('lock') @UseGuards(IdempotencyGuard)
  @ApiParam({name:'personId',format:'uuid'}) @ApiHeader({name:'Idempotency-Key',required:true})
  @ApiOperation({operationId:'adminLockPersonAccount',summary:'安全鎖定 Person 並撤銷所有 LINE sessions',description:'Idempotent, audited security containment. It does not alter qualification, GPV, awards, settlement, carry, or payout facts.'})
  @ApiResponse({status:201,description:'Person is SECURITY_LOCKED and active LINE sessions were revoked'})
  @ApiResponse({status:409,description:'Idempotency key reused with different command'})
  lock(@Param('personId') personId:string,@Body() body:AccountSecurityReasonDto,@Headers('idempotency-key') key:string,@Req() req:any){
    return this.service.lockPersonCommand(personId,body.reasonCode,key,{actorType:'ADMIN',actorId:req.user?.personId,requestId:req.requestId}).then(result=>({data:result.value,meta:{replayed:result.replayed}}));
  }

  @Post('line-binding/revoke') @UseGuards(IdempotencyGuard)
  @ApiParam({name:'personId',format:'uuid'}) @ApiHeader({name:'Idempotency-Key',required:true})
  @ApiOperation({operationId:'adminRevokePersonLineBinding',summary:'撤銷 Person 的所有 active LINE bindings',description:'Idempotent, audited identity containment. Revoked bindings cannot authenticate a Member session.'})
  @ApiResponse({status:201,description:'Active LINE bindings and sessions revoked'})
  @ApiResponse({status:409,description:'Idempotency key reused with different command'})
  revoke(@Param('personId') personId:string,@Body() body:AccountSecurityReasonDto,@Headers('idempotency-key') key:string,@Req() req:any){
    return this.service.revokeLineBindingCommand(personId,body.reasonCode,key,{actorType:'ADMIN',actorId:req.user?.personId,requestId:req.requestId}).then(result=>({data:result.value,meta:{replayed:result.replayed}}));
  }

  @Post('line-rebind-requests') @UseGuards(IdempotencyGuard)
  @ApiParam({name:'personId',format:'uuid'}) @ApiHeader({name:'Idempotency-Key',required:true})
  @ApiOperation({operationId:'adminCreateLineRebindRequest',summary:'建立 LINE 換綁申請',description:'Creates a PENDING recovery request with an auditable verification reference. It accepts no LINE token, bank account, or raw identity document.'})
  @ApiResponse({status:201,description:'PENDING LINE_REBIND request created or returned by the same idempotency key'})
  @ApiResponse({status:409,description:'Completed rebind cooldown is active'})
  createRebindRequest(@Param('personId') personId:string,@Body() body:LineRebindRequestDto,@Headers('idempotency-key') key:string,@Req() req:any){
    return this.service.createLineRebindRequest(personId,{verificationEvidence:{reference:body.verificationReference},reasonCode:body.reasonCode,idempotencyKey:key},{actorType:'ADMIN',actorId:req.user?.personId,requestId:req.requestId}).then(data=>({data}));
  }
}
