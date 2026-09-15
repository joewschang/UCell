import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: '1' })
  @Matches(/^[0-9]+(\.[0-9]{1,4})?$/)
  quantity!: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ enum:['ENTRY','RETAIL','REPURCHASE','SUBSCRIPTION_PREPAY','UPGRADE'] })
  @IsOptional()
  @IsEnum(['ENTRY','RETAIL','REPURCHASE','SUBSCRIPTION_PREPAY','UPGRADE'])
  purpose?:'ENTRY'|'RETAIL'|'REPURCHASE'|'SUBSCRIPTION_PREPAY'|'UPGRADE';

  @ApiProperty({ format: 'uuid', description: '訂單歸屬 Qualification' })
  @IsUUID()
  qualificationId!: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ApiPropertyOptional({ description: '分享歸因Token，Server只存Hash/解析結果' })
  @IsOptional()
  @IsString()
  sourceReferralToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientReference?: string;
}
