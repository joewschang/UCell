import { Roles } from '../auth/roles.decorator';
import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RpvService } from './rpv.service';

@ApiTags('Admin - RPV')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/rpv')
export class RpvController {
  constructor(private readonly service:RpvService){}

  @Post('recognitions/:recognitionId/run')
  @ApiOperation({operationId:'adminRunMonthlyRpvRecognition',summary:'手動執行單月RPV認列'})
  async run(@Param('recognitionId') id:string){ return {data:await this.service.recognize(id)}; }

  @Get('recognitions/:recognitionId/awards')
  @ApiOperation({operationId:'adminGetMonthlyRpvAwards',summary:'查詢該月RPV向上獎勵'})
  async awards(@Param('recognitionId') id:string){ return {data:await this.service.listAwards(id)}; }
}
