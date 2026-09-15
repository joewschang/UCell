import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class OpenActivePeriodDto {
  @ApiProperty({format:'date-time'})
  @IsISO8601()
  activeFrom!:string;

  @ApiPropertyOptional({format:'date-time'})
  @IsOptional()
  @IsISO8601()
  activeTo?:string;

  @ApiProperty({example:'REPURCHASE'})
  @IsString()
  sourceType!:string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ruleVersionCode?:string;
}
