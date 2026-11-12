import {Type} from 'class-transformer';
import {ArrayMaxSize, ArrayMinSize, IsArray, IsDefined, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, ValidateNested} from 'class-validator';
import {ApiProperty,ApiPropertyOptional} from '@nestjs/swagger';
import {SPONSOR_CODE} from '../qualification/sponsor-resolver.service';

export class BundleRootSponsorInput {
  @ApiProperty() @IsString() @Matches(SPONSOR_CODE) sponsorCode!:string;
}

export class BundleSponsorQuery {
  @ApiProperty() @IsString() @Matches(SPONSOR_CODE) code!:string;
}

class SelectedProduct {
  @ApiProperty() @IsUUID() productRuleProfileId!:string;
  @ApiProperty({minimum:1}) @IsInt() @Min(1) quantity!:number;
}

export class BundlePackage {
  @ApiProperty() @IsUUID() packageVersionId!:string;
  @ApiProperty() @Matches(/^[a-f0-9]{64}$/) quoteHash!:string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[a-zA-Z0-9_-]{3,40}$/) couponCode?:string;
  @ApiProperty({type:[SelectedProduct]}) @IsArray() @ValidateNested({each:true}) @Type(()=>SelectedProduct) selections!:SelectedProduct[];
}

class BundleBallInput {
  @ApiProperty({type:BundlePackage}) @IsDefined() @IsObject() @ValidateNested() @Type(()=>BundlePackage) qualification!:BundlePackage;
  @ApiPropertyOptional({type:BundlePackage}) @IsOptional() @IsObject() @ValidateNested() @Type(()=>BundlePackage) repurchase?:BundlePackage;
}

export class EnrollmentBundleInput {
  @ApiPropertyOptional({enum:['EXCELLENCE']}) @IsOptional() @IsIn(['EXCELLENCE']) planCode?:'EXCELLENCE';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) sponsorCode?:string;
  @ApiPropertyOptional({enum:['DELIVERY','COMPANY_PICKUP']}) @IsOptional() @IsIn(['DELIVERY','COMPANY_PICKUP']) fulfillmentMethod?:'DELIVERY'|'COMPANY_PICKUP';
  @ApiPropertyOptional() @IsOptional() @IsISO8601() deliveryUpdatedAt?:string;
  @ApiProperty({type:[BundleBallInput],minItems:2,maxItems:63}) @IsArray() @ArrayMinSize(2) @ArrayMaxSize(63) @ValidateNested({each:true}) @Type(()=>BundleBallInput) balls!:BundleBallInput[];
}
