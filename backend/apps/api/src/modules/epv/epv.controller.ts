import { Roles } from '../auth/roles.decorator';
import { Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EpvService } from './epv.service';

@ApiTags('Admin - EPV')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/epv')
export class EpvController {
  constructor(private readonly service:EpvService){}

  @Post('orders/:orderId/recognize')
  @ApiOperation({operationId:'adminRecognizeOrderEpv',summary:'認列重購超額EPV'})
  async run(@Param('orderId') id:string){ return {data:await this.service.recognizeOrder(id)}; }
}
