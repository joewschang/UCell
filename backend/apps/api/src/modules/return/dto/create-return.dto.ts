import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsISO8601, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

export class ReturnLineDto {
  @ApiProperty({format:'uuid'})
  @IsUUID()
  orderLineId!:string;

  @ApiProperty({example:'1'})
  @Matches(/^[0-9]+(\.[0-9]{1,4})?$/)
  quantity!:string;
}

export class CreateReturnDto {
  @ApiProperty()
  @IsString()
  reasonCode!:string;

  @ApiProperty({format:'date-time'})
  @IsISO8601()
  occurredAt!:string;

  @ApiProperty({type:[ReturnLineDto]})
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({each:true})
  @Type(()=>ReturnLineDto)
  lines!:ReturnLineDto[];
}
