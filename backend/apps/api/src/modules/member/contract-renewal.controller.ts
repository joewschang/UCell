import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Equals, IsUUID, Matches } from 'class-validator';
import { PrismaService } from '@ucell/database';
import { MemberAuthenticationGuard } from '../auth/member-authentication.guard';
import { Roles } from '../auth/roles.decorator';
import { renewContract, renewalView } from './contract-renewal';

class RenewalDto {
  @Matches(/^[a-f0-9]{64}$/) expectedSnapshotHash!:string;
  @IsUUID() contractVersionId!:string;
  @Matches(/^[a-f0-9]{64}$/) contentHash!:string;
  @Equals(true) confirmed!:boolean;
}
function actor(req:any):string {
  if(!req.user?.personId) throw new ForbiddenException();
  return req.user.personId;
}
@Controller('member/formal-applications')
@UseGuards(MemberAuthenticationGuard)
export class MemberContractRenewalController {
  constructor(private readonly db:PrismaService){}
  @Get(':id/contract-renewal') read(@Param('id',ParseUUIDPipe) id:string,@Req() req:any){
    const person=actor(req);return this.db.$transaction(tx=>renewalView(tx,id,person),{isolationLevel:'RepeatableRead'});
  }
  @Post(':id/contract-renewal') update(@Param('id',ParseUUIDPipe) id:string,@Req() req:any,@Body() body:RenewalDto){
    const person=actor(req);return this.db.$transaction(tx=>renewContract(tx,id,person,person,body,req.requestId));
  }
}
@Controller('admin/formal-applications')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
export class AdminContractRenewalController {
  constructor(private readonly db:PrismaService){}
  @Get(':id/contract-renewal') read(@Param('id',ParseUUIDPipe) id:string){
    return this.db.$transaction(tx=>renewalView(tx,id),{isolationLevel:'RepeatableRead'});
  }
  @Post(':id/contract-renewal') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS')
  update(@Param('id',ParseUUIDPipe) id:string,@Req() req:any,@Body() body:RenewalDto){
    const admin=actor(req);return this.db.$transaction(tx=>renewContract(tx,id,undefined,admin,body,req.requestId));
  }
}
