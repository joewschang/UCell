import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {FormalMemberApplicationService} from './formal-member-application.service';

@ApiTags('Admin - Formal Member Application')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/formal-member-applications')
export class AdminFormalMemberApplicationController {
 constructor(private readonly service:FormalMemberApplicationService){}
 @Get() @ApiOperation({operationId:'adminListFormalMemberApplications',description:'Read-only metadata queue. The encrypted application payload is never decrypted or returned.'})
 list(@Query('status') status?:string,@Query('take') take?:string){return this.service.adminList({status:status||undefined,take:Number(take??50)});}
}
