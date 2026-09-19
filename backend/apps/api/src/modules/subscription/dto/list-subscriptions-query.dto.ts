import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const subscriptionStatuses = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'COMPLETED'] as const;
// Keep this aligned with ballNoFor(): a 40-character tree code plus either
// `X` and six bootstrap digits (47 total) or a signed-bigint position suffix
// (at most 19 digits, 59 total).
export const ballNoPattern = /^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6}|\d{6,19})$/;

export class ListSubscriptionsQueryDto {
  @ApiPropertyOptional({ enum: subscriptionStatuses, description: 'Optional subscription lifecycle status.' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  status?: string;

  @ApiPropertyOptional({
    description: 'Exact immutable Ball Number for the operator-facing filter. UUIDs are not accepted by this field.',
    pattern: '^[A-Z][A-Z0-9_-]{0,39}(?:X\\d{6}|\\d{6,19})$',
    maxLength: 59,
  })
  @IsOptional()
  @IsString()
  @MaxLength(59)
  ballNo?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Legacy technical Qualification filter retained only for existing integrations. New operator-facing clients must use ballNo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  qualificationId?: string;

  @ApiPropertyOptional({ description: 'Maximum rows, 1 through 200. Defaults to 100.', maximum: 200, minimum: 1 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  take?: string;
}
