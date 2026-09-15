import { Roles } from '../auth/roles.decorator';
import { Controller,Get } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiTags } from '@nestjs/swagger';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('Admin - Dashboard')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT','CUSTOMER_SERVICE')
@Controller('admin/dashboard')
export class AdminDashboardController{
  constructor(private readonly service:AdminDashboardService){}
  @Get('summary')
  @ApiOperation({operationId:'adminDashboardSummary',summary:'管理後台營運摘要Read Model'})
  summary(){return this.service.summary().then(data=>({data}));}
}
