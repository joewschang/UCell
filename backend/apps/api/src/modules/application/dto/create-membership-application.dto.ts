import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, ValidateIf, Matches } from 'class-validator';

export class CreateMembershipApplicationDto {
  @ApiProperty({ enum:['PERSON','LEGAL_ENTITY'] })
  @IsIn(['PERSON','LEGAL_ENTITY'])
  holderType!: 'PERSON'|'LEGAL_ENTITY';

  @ApiPropertyOptional({ format:'uuid' })
  @ValidateIf(o=>o.holderType==='PERSON')
  @IsUUID()
  personId?: string;

  @ApiPropertyOptional({ format:'uuid' })
  @ValidateIf(o=>o.holderType==='LEGAL_ENTITY')
  @IsUUID()
  legalEntityId?: string;

  @ApiProperty({ enum:['STARTER','ELITE','LEADER'] })
  @IsEnum(['STARTER','ELITE','LEADER'])
  requestedPlanLevelCode!: 'STARTER'|'ELITE'|'LEADER';

  @ApiPropertyOptional({ format:'uuid' })
  @IsOptional()
  @IsUUID()
  sponsorQualificationId?: string;

  @ApiPropertyOptional({pattern:'^[A-Z][A-Z0-9_-]{1,39}$',description:'Paper Sponsor Ball code or governed Company Alias. The server resolves it authoritatively; UUID is never a public Sponsor Code.'})
  @IsOptional()
  @Matches(/^[A-Z][A-Z0-9_-]{1,39}$/)
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
