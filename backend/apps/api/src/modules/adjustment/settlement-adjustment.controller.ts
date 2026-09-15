import { Roles } from '../auth/roles.decorator';
import { Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettlementAdjustmentService } from './settlement-adjustment.service';

@ApiTags('Admin - Settlement Adjustment')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/settlement-adjustments')
export class SettlementAdjustmentController {
  constructor(private readonly service:SettlementAdjustmentService){}

  @Post('requests/:id/prepare')
  @ApiOperation({summary:'建立不可覆寫歷史的補償結算批次'})
  prepare(@Param('id') id:string){ return this.service.prepare(id); }

  @Post('requests/:id/calculate-and-post')
  @ApiOperation({summary:'以R1.0B deterministic replay重算Binary/Matching並寫Delta'})
  run(@Param('id') id:string){ return this.service.calculateAndPost(id); }
}
