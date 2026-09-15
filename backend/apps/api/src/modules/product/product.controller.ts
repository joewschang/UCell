import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductService } from './product.service';

@ApiTags('Admin - Product Reference')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT')
@Controller('admin/products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Post()
  @ApiOperation({ operationId: 'adminUpsertProductReference', summary: '建立/更新Pre-ERP商品Reference與Rule Profile' })
  async upsert(@Body() dto: { sku: string; displayName: string; price: string; gpvRate?: string; ruleVersionCode?: string }) {
    return { data: await this.service.upsertReference(dto) };
  }

  @Get()
  @ApiOperation({ operationId: 'adminListProducts', summary: '商品Reference清單' })
  async list() {
    return { data: await this.service.list() };
  }
}
