import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

export class PaymentConfirmationDto {
  @ApiProperty({ example: '14400.00' })
  @Matches(/^[0-9]+(\.[0-9]{1,2})?$/)
  amount!: string;

  @ApiProperty({ example: 'BANK_TRANSFER' })
  @IsString()
  paymentMethod!: string;

  @ApiProperty()
  @IsString()
  referenceNo!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  occurredAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
