import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreatePersonDto {
  @ApiProperty({ description: '法定姓名', example: '王小明' })
  @IsString()
  legalName!: string;

  @ApiPropertyOptional({ description: '慣用名稱' })
  @IsOptional()
  @IsString()
  preferredName?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}
