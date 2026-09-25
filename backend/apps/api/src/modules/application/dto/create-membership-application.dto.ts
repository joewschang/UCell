import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

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

  @ApiPropertyOptional({pattern:'^[A-Z][A-Z0-9_-]{0,39}(?:X\\d{6,}|\\d{6,})$',description:'Paper Sponsor Ball code. Resolved by the same server-side resolver as online qualification acquisition; UUID is never a public Sponsor Code.'})
  @IsOptional()
  @Matches(/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/)
  sponsorCode?: string;

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
