import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { OrganizationService } from './organization.service';

@ApiTags('Admin - Organization')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/organization')
export class OrganizationController {
  constructor(private readonly service:OrganizationService){}

  @Get('placement-preview')
  @ApiOperation({operationId:'adminPreviewBinaryPlacement',summary:'預檢推薦序號與Binary安置合法性（不寫入）'})
  async preview(
    @Query('sponsorQualificationId') sponsorQualificationId:string,
    @Query('binaryParentQualificationId') binaryParentQualificationId:string,
    @Query('binarySide') binarySide:'LEFT'|'RIGHT',
  ){
    return {data:await this.service.previewPlacement({
      sponsorQualificationId,binaryParentQualificationId,binarySide,
    })};
  }

  @Post('binary-placement')
  @UseGuards(IdempotencyGuard)
  @ApiOperation({ operationId:'adminPlaceBinary', summary:'安置 Binary 位置' })
  async place(@Body() dto:Record<string,unknown>) {
    // TODO call organization application service.
    return { data:{ accepted:true } };
  }
}
