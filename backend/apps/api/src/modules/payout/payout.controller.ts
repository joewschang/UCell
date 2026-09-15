import { Roles } from '../auth/roles.decorator';
import { Body,Controller,Post } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiTags } from '@nestjs/swagger';
import { UnifiedPayableService } from './unified-payable.service';
@ApiTags('Admin - Payout') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/payouts')
export class PayoutController{
  constructor(private readonly service:UnifiedPayableService){}
  @Post('materialize') @ApiOperation({summary:'將已生效獎金統一轉入Payable Ledger'})
  materialize(@Body() b:{cutoff:string}){return this.service.materialize(new Date(b.cutoff));}
  @Post('batches') @ApiOperation({summary:'建立付款批次並依Outstanding Recovery逐筆抵扣'})
  create(@Body() b:{periodStart:string;periodEnd:string}){return this.service.createPayoutBatch(new Date(b.periodStart),new Date(b.periodEnd));}
}
