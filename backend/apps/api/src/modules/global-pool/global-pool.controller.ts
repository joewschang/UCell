import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GlobalPoolService } from './global-pool.service';

@ApiTags('Admin - Global/Welfare Pool')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/pools')
export class GlobalPoolController {
  constructor(private readonly service:GlobalPoolService){}

  @Post('global/settle')
  @ApiOperation({operationId:'adminSettleGlobalPool',summary:'月結全球5%池'})
  async global(@Body() body:{periodStart:string;periodEnd:string}){
    return {data:await this.service.evaluateAndSettle(new Date(body.periodStart),new Date(body.periodEnd))};
  }

  @Post('welfare/accrue')
  @ApiOperation({operationId:'adminAccrueWelfarePool',summary:'應計福利2%池，不自行分配'})
  async welfare(@Body() body:{periodStart:string;periodEnd:string}){
    return {data:await this.service.accrueWelfare(new Date(body.periodStart),new Date(body.periodEnd))};
  }
}
