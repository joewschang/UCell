import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class CreateQualificationDto {
  @ApiProperty({ format: 'uuid', description: '目前持有人 Person ID' })
  @IsUUID()
  personId!: string;

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
