import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiResponse,ApiTags} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDateString,IsInt,IsOptional,Matches,Max,Min} from 'class-validator';
import {Roles} from '../auth/roles.decorator';
import {MaturedPayableSourcesService} from './matured-payable-sources.service';
class MaturedPayableSourcesQueryDto{
 @ApiProperty({type:Number,minimum:1,maximum:8760}) @Type(()=>Number) @IsInt() @Min(1) @Max(8760) thresholdHours!:number;
 @ApiProperty({type:Number,required:false,minimum:1,maximum:100}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) take?:number;
 @ApiProperty({required:false,pattern:'^MATURED-AWARD-[a-f0-9]{40}$'}) @IsOptional() @Matches(/^MATURED-AWARD-[a-f0-9]{40}$/) cursor?:string;
 @ApiProperty({required:false,format:'date-time'}) @IsOptional() @IsDateString() asOf?:string;
}
class MaturedPayableSourceDto{
 @ApiProperty() reference!:string;
 @ApiProperty({enum:['BONUS_AWARD','RPV_UPLINE_AWARD','GLOBAL_POOL_AWARD']}) sourceType!:string;
 @ApiProperty() awardType!:string; @ApiProperty() qualificationNo!:string;
 @ApiProperty({type:String,description:'Stored payable decimal in canonical four fractional digits; no frontend computation'}) amount!:string;
 @ApiProperty({format:'date-time'}) maturesAt!:string; @ApiProperty() ruleVersionCode!:string; @ApiProperty({format:'date-time'}) recordedAt!:string;
}
class MaturedPayableSourcesPageDto{
 @ApiProperty({type:[MaturedPayableSourceDto]}) items!:MaturedPayableSourceDto[]; @ApiProperty({type:String,nullable:true}) nextCursor!:string|null;
 @ApiProperty({format:'date-time'}) asOf!:string; @ApiProperty({format:'date-time'}) dataThrough!:string; @ApiProperty({format:'date-time'}) cutoff!:string;
 @ApiProperty({type:Number}) thresholdHours!:number; @ApiProperty({enum:['CURRENT_PAGE_ONLY']}) coverage!:string;
}
class MaturedPayableSourcesEnvelopeDto{@ApiProperty({type:MaturedPayableSourcesPageDto}) data!:MaturedPayableSourcesPageDto;}
@ApiTags('Admin - Matured Payable Sources') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/operations/control/matured-payable-sources')
export class MaturedPayableSourcesController{
 constructor(private readonly service:MaturedPayableSourcesService){}
 @Get() @ApiOperation({operationId:'adminMaturedPayableSources',summary:'查閱已成熟且逾作業門檻但尚未建立應付的三類來源',description:'Read only. Company/Reservoir B destinations excluded. asOf bounds row admission; current payable/destination state is rechecked on each page, not a frozen historical financial snapshot.'}) @ApiOkResponse({type:MaturedPayableSourcesEnvelopeDto})
 @ApiResponse({status:400,description:'Invalid threshold, cursor, cutoff or query'}) @ApiResponse({status:401,description:'Admin authentication required'}) @ApiResponse({status:403,description:'Finance or compliance role required'})
 read(@Query() query:MaturedPayableSourcesQueryDto){return this.service.list(query).then(data=>({data}));}
}
