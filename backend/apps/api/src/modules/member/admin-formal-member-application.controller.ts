import {Controller,Get,Param,ParseUUIDPipe,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {FormalMemberApplicationService} from './formal-member-application.service';
import {FormalMembershipConflictService} from './formal-membership-conflict.service';

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
}
