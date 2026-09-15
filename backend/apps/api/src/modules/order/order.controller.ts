import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentConfirmationDto } from './dto/payment-confirmation.dto';
import { OrderService } from './order.service';

@ApiTags('Admin - Commerce')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/orders')
export class OrderController {
  constructor(private readonly service: OrderService) {}


  @Get()
  @ApiOperation({operationId:'adminSearchOrders',summary:'搜尋／列出訂單'})
  async search(
    @Query('status') status?: string,
    @Query('qualificationId') qualificationId?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ){
    return {data:await this.service.search({
      status:status || undefined,
      qualificationId:qualificationId || undefined,
      q:q || undefined,
      take:Number(take ?? 50),
    })};
  }

  @Post()
  @UseGuards(IdempotencyGuard)
  @ApiOperation({ operationId: 'adminCreateOrder', summary: '建立並確認會員訂單' })
  async create(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') key: string,
    @Req() req: any,
  ) {
    const result = await this.service.create(dto, key, req.requestId, req.user?.personId);
    return { data: result.value, meta: { replayed: result.replayed } };
  }

  @Post(':orderId/payment-confirmations')
  @UseGuards(IdempotencyGuard)
  @ApiOperation({ operationId: 'adminConfirmPayment', summary: 'Pre-ERP人工確認付款' })
  async confirmPayment(
    @Param('orderId') orderId: string,
    @Body() dto: PaymentConfirmationDto,
    @Headers('idempotency-key') key: string,
    @Req() req: any,
  ) {
    const result = await this.service.confirmPayment(orderId, dto, key, req.requestId, req.user?.personId);
    return { data: result.value, meta: { replayed: result.replayed } };
  }

  @Get(':orderId')
  @ApiOperation({ operationId: 'adminGetOrder', summary: '取得訂單與付款事件' })
  async get(@Param('orderId') orderId: string) {
    return { data: await this.service.get(orderId) };
  }
}
