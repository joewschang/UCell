import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { Roles } from '../auth/roles.decorator';
import { UatEvidenceService } from './uat-evidence.service';

const classifications = ['LOCAL_ASSISTIVE_ONLY', 'FORMAL_UAT_EVIDENCE'] as const;
const results = ['PASS', 'FAIL', 'BLOCKED'] as const;

export class RecordUatEvidenceDto {
  @ApiProperty({ enum: classifications }) @IsEnum(classifications)
  classification!: typeof classifications[number];

  @ApiProperty({ example: 'CONNECTED_DEV' }) @IsString() @MinLength(1) @MaxLength(40)
  environment!: string;

  @ApiProperty({ example: 'UAT-R6-001' }) @IsString() @MinLength(1) @MaxLength(80)
  scenarioCode!: string;

  @ApiProperty({ enum: results }) @IsEnum(results)
  result!: typeof results[number];

  @ApiProperty({ description: 'Lowercase SHA-256 of the referenced immutable evidence artifact.' })
  @Matches(/^[0-9a-f]{64}$/) evidenceHash!: string;

  @ApiProperty({ description: 'Governed object URI, build artifact reference, or immutable evidence identifier.' })
  @IsString() @MinLength(1) @MaxLength(1000) artifactReference!: string;

  @ApiPropertyOptional({ description: 'Required for FORMAL_UAT_EVIDENCE; identifies the approved execution authority.' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) approvalReference?: string;

  @ApiProperty({ format: 'date-time' }) @IsISO8601() executedAt!: string;
}

@ApiTags('Admin - UAT Evidence')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN', 'COMPLIANCE_AUDIT')
@Controller('admin/uat-evidence')
export class UatEvidenceController {
  constructor(private readonly service: UatEvidenceService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  @UseGuards(IdempotencyGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'adminRecordUatEvidence', summary: 'Append UAT execution evidence; this does not sign off UAT or pass a release gate.' })
  record(@Body() body: RecordUatEvidenceDto, @Headers('idempotency-key') key: string, @Req() req: any) {
    return this.service.record(body, key, req.user?.personId, req.requestId, req.correlationId ?? randomUUID());
  }

  @Get()
  @ApiOperation({ operationId: 'adminListUatEvidence', summary: 'Read append-only UAT execution evidence.' })
  list(@Query('environment') environment?: string, @Query('scenarioCode') scenarioCode?: string) {
    return this.service.list({ environment, scenarioCode });
  }
}
