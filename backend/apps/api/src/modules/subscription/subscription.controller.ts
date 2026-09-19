import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { SubscriptionService } from './subscription.service';
import { SubscriptionCancellationService } from './subscription-cancellation.service';

@ApiTags('Admin - Subscription')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/subscriptions')
export class SubscriptionController {
  constructor(
    private readonly service:SubscriptionService,
    private readonly cancellation:SubscriptionCancellationService,
  ){}

  @Get('plans')
  @ApiOperation({operationId:'adminListSubscriptionPlans',summary:'重銷方案'})
  async plans(){ return {data:await this.service.listPlans()}; }
  @Get()
  @ApiOperation({operationId:'adminListSubscriptions',summary:'訂閱清單與 Ball Number/status 篩選；只讀既存Core資料，不建立營運日曆'})
  async list(@Query() query:ListSubscriptionsQueryDto){
    return {data:await this.service.list({
      status:query.status,
      ballNo:query.ballNo,
      qualificationId:query.qualificationId,
      take:query.take===undefined?undefined:Number(query.take),
    })};
  }

  @Post()
  @UseGuards(IdempotencyGuard)
  @ApiOperation({operationId:'adminCreateSubscription',summary:'建立季/半年/年重銷訂閱與逐月排程'})
  async create(@Body() dto:CreateSubscriptionDto,@Headers('idempotency-key') key:string,@Req() req:any){
    const r=await this.service.create(dto,key,req.requestId,req.user?.personId);
    return {data:r.value,meta:{replayed:r.replayed}};
  }

  @Get(':id')
  @ApiOperation({operationId:'adminGetSubscription',summary:'訂閱與逐月認列排程'})
  async get(@Param('id') id:string){ return {data:await this.service.get(id)}; }

  @Post(':id/cancel')
  @ApiOperation({operationId:'adminCancelSubscription',summary:'取消Subscription；未來Recognition取消，已認列月份排程RPV reversal'})
  async cancel(
    @Param('id') id:string,
    @Body() body:{effectiveAt:string;reasonCode:string;refundAmount?:string},
  ){
    return {
      data:await this.cancellation.cancel(
        id,new Date(body.effectiveAt),body.reasonCode,body.refundAmount ?? '0'
      )
    };
  }
}
