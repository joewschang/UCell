import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from './roles.decorator';
import { AdminRoleGuard } from './admin-role.guard';
import { LineIntegrationStatusService } from './line-integration-status.service';

@ApiTags('Admin - LINE Integration')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS')
@UseGuards(AdminRoleGuard)
@Controller('admin/integrations/line')
export class LineIntegrationStatusController {
  constructor(private readonly service:LineIntegrationStatusService){}
  @Get('status')
  @ApiOperation({operationId:'adminLineIntegrationStatus',summary:'Read LINE integration readiness and notification delivery summary',description:'Returns configuration presence and aggregate delivery state only. It never returns LINE secrets, access tokens, raw webhook payloads, or LINE subjects.'})
  @ApiResponse({status:200,description:'Read-only LINE readiness and aggregate delivery queue state'})
  @ApiResponse({status:403,description:'Role denied'})
  status(){return this.service.read().then(data=>({data}));}
}