import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({format:'uuid'})
  @IsUUID()
  qualificationId!:string;

  @ApiProperty({enum:['QUARTER','HALF_YEAR','YEAR']})
  @IsEnum(['QUARTER','HALF_YEAR','YEAR'])
  planCode!:'QUARTER'|'HALF_YEAR'|'YEAR';

  @ApiProperty({format:'date',description:'建議使用該月1日'})
  @IsDateString()
  startMonth!:string;

  @ApiPropertyOptional({format:'uuid'})
  @IsOptional()
  @IsUUID()
  orderId?:string;
}
