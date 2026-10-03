import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class CreateQualificationDto {
  @ApiProperty({enum:['PERSON','LEGAL_ENTITY']})
  @IsIn(['PERSON','LEGAL_ENTITY'])
  holderType!: 'PERSON'|'LEGAL_ENTITY';

  @ApiPropertyOptional({ format: 'uuid', description: '自然人持有人 Person ID' })
  @ValidateIf(o=>o.holderType==='PERSON')
  @IsUUID()
  personId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: '法人持有人 LegalEntity ID' })
  @ValidateIf(o=>o.holderType==='LEGAL_ENTITY')
  @IsUUID()
  legalEntityId?: string;

  @ApiProperty({ enum: ['STARTER', 'ELITE', 'LEADER'], description: '方案級別' })
  @IsEnum(['STARTER', 'ELITE', 'LEADER'])
  planLevelCode!: 'STARTER' | 'ELITE' | 'LEADER';

  @ApiProperty({ format: 'uuid', description: 'Sponsor Tree 推薦人 Qualification' })
  @IsUUID()
  sponsorQualificationId!: string;

  @ApiProperty({ format: 'uuid', description: 'Binary Tree Parent Qualification' })
  @IsUUID()
  binaryParentQualificationId!: string;

  @ApiProperty({ enum: ['LEFT', 'RIGHT'] })
  @IsEnum(['LEFT', 'RIGHT'])
  binarySide!: 'LEFT' | 'RIGHT';

  @ApiPropertyOptional({ format: 'date-time', description: '預設為目前時間' })
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;
}
