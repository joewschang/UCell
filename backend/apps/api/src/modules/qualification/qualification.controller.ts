import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { CreateQualificationDto } from './dto/create-qualification.dto';
import { QualificationService } from './qualification.service';
import { SystemAssignmentService } from './system-assignment.service';
import { adminQualification360Schema } from './admin-qualification-360';
import { IsEnum,IsISO8601,IsOptional,IsString,IsUUID,MaxLength } from 'class-validator';
class SystemAssignedQualificationDto { @ApiProperty({format:'uuid'}) @IsUUID() personId!:string; @ApiProperty({enum:['STARTER','ELITE','LEADER']}) @IsEnum(['STARTER','ELITE','LEADER']) planLevelCode!:'STARTER'|'ELITE'|'LEADER'; @ApiProperty({maxLength:80}) @IsString() @MaxLength(80) policyVersion!:string; @ApiPropertyOptional({format:'date-time'}) @IsOptional() @IsISO8601() effectiveAt?:string; }

@ApiTags('Admin - Qualification')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/qualifications')
export class QualificationController {
  constructor(private readonly service: QualificationService,private readonly systemAssignment:SystemAssignmentService) {}


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
  @Post('system-assigned') @UseGuards(IdempotencyGuard)
  @ApiOperation({operationId:'adminCreateSystemAssignedQualification',summary:'依核准版本化政策建立無有效推薦歸因的 Qualification'})
  async createSystemAssigned(@Body() dto:SystemAssignedQualificationDto,@Headers('idempotency-key') key:string,@Req() req:any){const result=await this.systemAssignment.create(dto,key,req.requestId,req.user?.personId);return {data:result.value,meta:{replayed:result.replayed}};}

  @Get(':qualificationId')
  @ApiOperation({ operationId: 'adminGetQualification', summary: '取得 Qualification 詳情', description: 'Existing Ball detail plus a bounded admin360 server-side projection. Organization, owner, plan and global rank are returned only from their authoritative facts; unavailable evidence is not inferred.' })
  @ApiParam({ name: 'qualificationId', format: 'uuid' })
  @ApiResponse({ status: 200, schema: { type: 'object', required: ['data'], properties: {
    data: { type: 'object', properties: {
      qualificationId: { type: 'string', format: 'uuid' },
      qualificationNo: { type: 'string', description: 'Core BigInt serialized as decimal string' },
      ballNo: { type: 'string', nullable: true },
      planLevelCode: { type: 'string', nullable: true },
      status: { type: 'string' },
      activeFlag: { type: 'boolean' },
      admin360: adminQualification360Schema,
    } },
  } }, description: 'Admin Ball 360 read model. admin360 contains no relationship UUIDs, evidence hashes, or parameter snapshots.' })
  @ApiResponse({ status: 401, description: 'Admin authentication required' })
  @ApiResponse({ status: 403, description: 'Existing Qualification role policy denies access' })
  @ApiResponse({ status: 404, description: 'Qualification not found' })
  async get(@Param('qualificationId') qualificationId: string) {
    return { data: await this.service.get(qualificationId) };
  }
}
