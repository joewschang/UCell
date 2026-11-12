import { Body, ConflictException, Controller, ForbiddenException, Get, Headers, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, Min } from 'class-validator';
import { PrismaService } from '@ucell/database';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { Roles } from '../auth/roles.decorator';
import { lockChoice, payoutChoice, PayoutMethod, setChoice } from './formal-payout-method';

class ChangeMethod {
  @IsIn(['BANK_TRANSFER','COMPANY_CASH']) method!:PayoutMethod;
  @IsIn(['BANK_TRANSFER','COMPANY_CASH']) expectedMethod!:PayoutMethod;
  @IsInt() @Min(0) expectedVersion!:number;
}
@Controller('admin/formal-member-applications')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
export class FormalPayoutMethodController {
  constructor(private readonly db:PrismaService,private readonly idem:IdempotencyService,private readonly audit:AuditService){}
  @Get(':id/payout-method') async read(@Param('id',ParseUUIDPipe) id:string){return await payoutChoice(this.db,id);}
  @Post(':id/payout-method') @UseGuards(IdempotencyGuard) @Roles('SUPER_ADMIN','MEMBERSHIP_OPS')
  async change(@Param('id',ParseUUIDPipe) id:string,@Body() body:ChangeMethod,@Req() req:any,@Headers('idempotency-key') key:string){
    const actor=req.user?.personId;
    if(!actor) throw new ForbiddenException();
    const result=await this.idem.execute('admin:formal-payout-method:'+actor,key,{id,...body},async tx=>{
      const before=await lockChoice(tx,id);
      if(!before.editable||before.method!==body.expectedMethod||before.version!==body.expectedVersion)
        throw new ConflictException({code:'FORMAL_PAYOUT_METHOD_CONFLICT',message:'申請狀態或領款方式已更新，請重新整理。'});
      if(before.method===body.method) return before;
      await setChoice(tx,id,body.method,actor);
      await this.audit.write(tx,{actorType:'ADMIN',actorId:actor,actorRoleSnapshot:req.user.role,action:'FORMAL_PAYOUT_METHOD_CHANGED',
        entityType:'FormalMemberApplication',entityId:id,beforeData:{method:before.method,version:before.version},afterData:{method:body.method,version:before.version+1},requestId:req.requestId,correlationId:req.correlationId??req.requestId});
      return {method:body.method,version:before.version+1,editable:true};
    },{retryOnConflict:true});
    return result.value;
  }
}
