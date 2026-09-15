import { Roles } from '../auth/roles.decorator';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';

@ApiTags('Admin - Ledger')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/qualifications/:qualificationId/ledger')
export class LedgerController {
  constructor(private readonly service: LedgerService) {}

  @Get('pv')
  @ApiOperation({ operationId: 'adminListQualificationPv', summary: 'Qualification PV帳本' })
  async list(@Param('qualificationId') id: string, @Query('take') take?: string) {
    return { data: await this.service.listPv(id, Number(take ?? 50)) };
  }

  @Get('balances')
  @ApiOperation({ operationId: 'adminQualificationPvBalances', summary: 'Qualification PV餘額彙總' })
  async balances(@Param('qualificationId') id: string) {
    return { data: await this.service.balances(id) };
  }
}
