import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnService } from './return.service';
import { ReversalService } from './reversal.service';

@ApiTags('Admin - Return / Reversal')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/orders/:orderId/returns')
export class ReturnController {
  constructor(private readonly service:ReturnService,private readonly reversal:ReversalService){}

  @Post()
  @UseGuards(IdempotencyGuard)
  @ApiOperation({operationId:'adminPostReturn',summary:'建立退貨並發出RETURN_CONFIRMED'})
  async post(
    @Param('orderId') orderId:string,@Body() dto:CreateReturnDto,
    @Headers('idempotency-key') key:string,@Req() req:any
  ){
    const r=await this.service.post(orderId,dto,key,req.requestId,req.user?.personId);
    return {data:r.value,meta:{replayed:r.replayed}};
  }

  @Post(':returnCaseId/process-reversal')
  @ApiParam({name:'orderId',type:String,required:true})
  @ApiOperation({operationId:'adminProcessReturnReversal',summary:'處理GPV反向事件與獎金追回'})
  async reverse(@Param('returnCaseId') id:string){
    return {data:await this.reversal.processReturn(id)};
  }
}
