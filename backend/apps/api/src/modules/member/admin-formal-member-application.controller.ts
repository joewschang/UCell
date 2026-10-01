import {Controller,Get,Headers,Param,ParseUUIDPipe,Post,Query,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {FormalMemberApplicationService} from './formal-member-application.service';
import {FormalMembershipConflictService} from './formal-membership-conflict.service';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';

@ApiTags('Admin - Formal Member Application')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/formal-member-applications')
export class AdminFormalMemberApplicationController {
 constructor(private readonly service:FormalMemberApplicationService,private readonly conflicts:FormalMembershipConflictService){}
 @Get() @ApiOperation({operationId:'adminListFormalMemberApplications',description:'Read-only metadata queue. The encrypted application payload is never decrypted or returned.'})
 list(@Query('status') status?:string,@Query('take') take?:string){return this.service.adminList({status:status||undefined,take:Number(take??50)});}
 @Get(':id/cross-line-conflicts') @ApiOperation({operationId:'adminFormalMemberCrossLineConflicts',description:'Evaluate spouse, identity, representative and legal-entity duplicate conflicts from privacy-preserving indexes. Returns codes only; no raw national ID.'})
 conflictsFor(@Param('id',new ParseUUIDPipe()) id:string){return this.conflicts.evaluate(id);}
 @Post(':id/spouse-verification') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'adminVerifyFormalMemberSpouse',description:'Confirm spouse data against authorized KYC evidence. Persists only a masked spouse name and keyed identity fingerprint; raw spouse ID is never returned.'})
 verifySpouse(@Param('id',new ParseUUIDPipe()) id:string,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.verifySpouse(id,req.user?.personId,key,req.requestId);}
}
