import {Body,Controller,Get,Headers,Post,Query,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiTags} from '@nestjs/swagger';
import {IsISO8601,IsOptional,IsString,IsUUID,MaxLength,Matches,ValidateNested,IsArray,ArrayMinSize,IsInt,Min} from 'class-validator';
import {Type} from 'class-transformer';
import {Roles} from '../auth/roles.decorator';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {PaperIntakeService} from './paper-intake.service';

class PaperApplicationDto {
 @IsString() @Matches(/^\S(?:.*\S)?$/) @MaxLength(80) paperApplicationNo!:string;
 @IsUUID() personId!:string;
 @IsISO8601() receivedAt!:string;
 @IsOptional() @IsString() @MaxLength(500) evidenceDocumentRef?:string;
}
class PackageSelectionDto { @IsUUID() productRuleProfileId!:string; @IsInt() @Min(1) quantity!:number; }
class PaperQualificationOrderDto { @IsString() @Matches(/^\S(?:.*\S)?$/) @MaxLength(80) paperApplicationNo!:string; @IsUUID() packageVersionId!:string; @IsOptional() @IsString() @MaxLength(80) sponsorCode?:string; @IsArray() @ArrayMinSize(1) @ValidateNested({each:true}) @Type(()=>PackageSelectionDto) selections!:PackageSelectionDto[]; }

@ApiTags('Admin - Paper Intake') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS') @Controller('admin/paper-applications')
export class PaperIntakeController {
 constructor(private readonly service:PaperIntakeService){}
 @Get() @ApiOperation({operationId:'adminListPaperApplications',description:'Authorized paper-intake read model. Uses memberNo and paper application number; raw identity documents are never returned.'})
 list(@Query('status') status?:string,@Query('take') take?:string){return this.service.list({status:status||undefined,take:Number(take??50)}).then(data=>({data}));}
 @Post() @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'adminCreatePaperApplication',description:'Creates paper provenance for an existing Person only. New-person creation is fail-closed until approved duplicate identity matching is implemented.'})
 create(@Body() dto:PaperApplicationDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.create({...dto,key,actorId:req.user?.personId,requestId:req.requestId}).then(result=>({data:result.value,meta:{replayed:result.replayed}}));}
 @Post('qualification-orders') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'adminCreatePaperQualificationOrder',description:'Creates a Qualification package order through the same Package, Sponsor and Payment core. The paper application number is server-resolved; it never activates or places a Ball directly.'})
 order(@Body() dto:PaperQualificationOrderDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.createQualificationOrder({...dto,key,actorId:req.user?.personId,requestId:req.requestId}).then(result=>({data:result.value,meta:{replayed:result.replayed}}));}
}
