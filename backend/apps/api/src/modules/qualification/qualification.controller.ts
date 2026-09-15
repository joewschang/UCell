import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { CreateQualificationDto } from './dto/create-qualification.dto';
import { QualificationService } from './qualification.service';

@ApiTags('Admin - Qualification')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/qualifications')
export class QualificationController {
  constructor(private readonly service: QualificationService) {}


  @Get()
  @ApiOperation({operationId:'adminSearchQualifications',summary:'搜尋 Qualification / Sponsor / Binary節點'})
  async search(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('take') take?: string,
  ){
    return {data:await this.service.search({
      q:q || undefined,
      status:status || undefined,
      take:Number(take ?? 50),
    })};
  }

  @Post()
  @UseGuards(IdempotencyGuard)
  @ApiOperation({ operationId: 'adminCreateQualification', summary: '建立 Qualification + Sponsor/Binary 關係' })
  async create(
    @Body() dto: CreateQualificationDto,
    @Headers('idempotency-key') key: string,
    @Req() req: any,
  ) {
    const result = await this.service.create(dto, key, req.requestId, req.user?.personId);
    return { data: result.value, meta: { replayed: result.replayed } };
  }

  @Get(':qualificationId')
  @ApiOperation({ operationId: 'adminGetQualification', summary: '取得 Qualification 詳情' })
  async get(@Param('qualificationId') qualificationId: string) {
    return { data: await this.service.get(qualificationId) };
  }
}
