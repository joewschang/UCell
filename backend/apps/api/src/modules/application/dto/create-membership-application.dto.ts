import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMembershipApplicationDto {
  @ApiProperty({ format:'uuid' })
  @IsUUID()
  personId!: string;

  @ApiProperty({ enum:['STARTER','ELITE','LEADER'] })
  @IsEnum(['STARTER','ELITE','LEADER'])
  requestedPlanLevelCode!: 'STARTER'|'ELITE'|'LEADER';

  @ApiPropertyOptional({ format:'uuid' })
  @IsOptional()
  @IsUUID()
  sponsorQualificationId?: string;

  @ApiPropertyOptional({ format:'uuid' })
  @IsOptional()
  @IsUUID()
  binaryParentQualificationId?: string;

  @ApiPropertyOptional({ enum:['LEFT','RIGHT'] })
  @IsOptional()
  @IsEnum(['LEFT','RIGHT'])
  binarySide?: 'LEFT'|'RIGHT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceReferralToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
