import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { QualificationPlacementService } from '../qualification/qualification-placement.service';
import { OrganizationService } from './organization.service';

class LegacyAdminBinaryPlacementDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() qualificationId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() binaryParentQualificationId!: string;
  @ApiProperty({ enum: ['LEFT', 'RIGHT'] }) @IsEnum(['LEFT', 'RIGHT']) side!: 'LEFT' | 'RIGHT';
  @ApiProperty({ maxLength: 120 }) @IsString() @MinLength(1) @MaxLength(120) reasonCode!: string;
}

@ApiTags('Admin - Organization')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/organization')
export class OrganizationController {
  constructor(
    private readonly service: OrganizationService,
    private readonly placement: QualificationPlacementService,
  ) {}

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
  @Roles('SUPER_ADMIN','QUALIFICATION_PLACEMENT_OVERRIDE')
  @UseGuards(IdempotencyGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId:'adminPlaceBinary',
    summary:'安置 Binary 位置（相容端點）',
    description:'Delegates to the canonical Qualification placement command with the same authorization, legality, concurrency, evidence and audit controls.',
  })
  async place(
    @Body() dto: LegacyAdminBinaryPlacementDto,
    @Headers('idempotency-key') key: string,
    @Req() req: any,
  ) {
    const result = await this.placement.placeByAdmin(
      req.user?.personId,
      {
        qualificationId: dto.qualificationId,
        binaryParentQualificationId: dto.binaryParentQualificationId,
        side: dto.side,
        reasonCode: dto.reasonCode,
      },
      key,
      req.requestId,
    );
    return { data: result.value, meta: { replayed: result.replayed } };
  }
}
