import {Body,Controller,Get,HttpCode,Post,Query,Req,UnauthorizedException,UsePipes,ValidationPipe} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiResponse,ApiTags} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsISO8601,IsInt,IsOptional,IsString,Length,Max,Min} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {CompensationStageHistoryService} from './compensation-stage-history.service';
class CompensationStagePeriodDto{
 @ApiProperty({format:'date-time'}) @IsISO8601({strict:true}) periodStart!:string;
 @ApiProperty({format:'date-time'}) @IsISO8601({strict:true}) periodEnd!:string;
 @ApiProperty({minLength:1,maxLength:100}) @IsString() @Length(1,100) ruleVersionCode!:string;
}
class CompensationStageHistoryQueryDto extends CompensationStagePeriodDto{
 @ApiProperty({required:false,minimum:1,maximum:100}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) take?:number;
 @ApiProperty({required:false,minimum:1,maximum:2147483647}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(2147483647) cursor?:number;
 @ApiProperty({required:false,format:'date-time'}) @IsOptional() @IsISO8601({strict:true}) asOf?:string;
}
class CompensationStageObservationDto{
 @ApiProperty() reference!:string; @ApiProperty({minimum:1}) revision!:number;
 @ApiProperty({type:String,nullable:true}) previousStage!:string|null; @ApiProperty() stage!:string;
 @ApiProperty({format:'date-time'}) sourceAsOf!:string; @ApiProperty({format:'date-time'}) observedAt!:string;
 @ApiProperty() evidenceHash!:string;
 @ApiProperty({type:String,nullable:true,description:'Unavailable. Observation time does not reconstruct business stage entry.'}) businessEnteredAt!:null;
 @ApiProperty({enum:['AUTHORITATIVE_CONTROL_OBSERVATION']}) basis!:string;
}
class CompensationStageHistoryPageDto{
 @ApiProperty({type:[CompensationStageObservationDto]}) items!:CompensationStageObservationDto[];
 @ApiProperty({type:Number,nullable:true}) nextCursor!:number|null; @ApiProperty({format:'date-time'}) asOf!:string;
 @ApiProperty({enum:['CURRENT_PAGE_ONLY']}) coverage!:string; @ApiProperty() authority!:string;
}
class CompensationStageRefreshDto{@ApiProperty({type:CompensationStageObservationDto}) item!:CompensationStageObservationDto;@ApiProperty({format:'date-time'}) checkedThrough!:string;@ApiProperty() authority!:string;}
class CompensationStageHistoryEnvelopeDto{@ApiProperty({type:CompensationStageHistoryPageDto}) data!:CompensationStageHistoryPageDto;}
class CompensationStageRefreshEnvelopeDto{@ApiProperty({type:CompensationStageRefreshDto}) data!:CompensationStageRefreshDto;}
@ApiTags('Admin - Compensation Stage History') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/compensation-period-control/stage-history')
@UsePipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}))
@ApiResponse({status:400,description:'Invalid period or query'}) @ApiResponse({status:401,description:'Authenticated Admin actor required'}) @ApiResponse({status:403,description:'Role denied'})
export class CompensationStageHistoryController{
 constructor(private readonly service:CompensationStageHistoryService){}
 @Get() @ApiOperation({operationId:'adminCompensationStageHistory',summary:'查閱期別階段觀察歷程',description:'Read only; reverse revision pagination retains recorded observation cutoff. Unobserved transitions and actual business stage entry are not reconstructed.'}) @ApiOkResponse({type:CompensationStageHistoryEnvelopeDto})
 read(@Query() query:CompensationStageHistoryQueryDto){return this.service.list(query).then(data=>({data}));}
 @Post('refresh') @HttpCode(200) @Roles('SUPER_ADMIN','FINANCE')
 @ApiOperation({operationId:'adminRefreshCompensationStageHistory',summary:'查核並保存期別階段觀察',description:'Determines stage from authoritative control facts and records actor audit atomically. No settlement, payment, ERP submission or financial close. Caller cannot supply stage/time.'}) @ApiOkResponse({type:CompensationStageRefreshEnvelopeDto})
 refresh(@Body() body:CompensationStagePeriodDto,@Req() req:any){
  if(!req.user?.personId)throw new UnauthorizedException('AUTHENTICATED_ACTOR_REQUIRED');
  return this.service.refresh(body,{actorId:req.user.personId,actorRole:req.user.role,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()}).then(data=>({data}));
 }
}
