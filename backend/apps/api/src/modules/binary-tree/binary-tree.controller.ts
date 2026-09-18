import {Body,Controller,Headers,Param,ParseUUIDPipe,Post,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiProperty,ApiPropertyOptional,ApiTags} from '@nestjs/swagger';
import {IsIn,IsInt,IsOptional,IsString,IsUUID,MaxLength,Min,MinLength,Matches} from 'class-validator';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {Roles} from '../auth/roles.decorator';
import {BinaryTreeService,TreePrincipal} from './binary-tree.service';
class ReasonDto {
 @ApiProperty({maxLength:500}) @IsString() @MinLength(1) @MaxLength(500) reason!:string;
}
class CreateTreeDto extends ReasonDto {
 @ApiProperty({maxLength:120}) @IsString() @MinLength(1) @MaxLength(120) treeName!:string;
 @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Z][A-Z0-9_-]{2,39}$/) treeCode?:string;
}
class ChangeTreeDto extends ReasonDto {
 @ApiPropertyOptional({enum:['ACTIVE','CLOSED_TO_NEW','ARCHIVED']}) @IsOptional() @IsIn(['ACTIVE','CLOSED_TO_NEW','ARCHIVED']) status?:'ACTIVE'|'CLOSED_TO_NEW'|'ARCHIVED';
 @ApiPropertyOptional({maxLength:120}) @IsOptional() @IsString() @MinLength(1) @MaxLength(120) treeName?:string;
 @ApiProperty({minimum:1}) @IsInt() @Min(1) expectedVersion!:number;
}
class ConfirmSponsorDto extends ReasonDto {
 @ApiProperty({format:'uuid'}) @IsUUID() qualificationId!:string;
}
class PlaceTreeDto extends ConfirmSponsorDto {
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) preflightToken!:string;
 @ApiProperty({format:'uuid'}) @IsUUID() binaryParentQualificationId!:string;
 @ApiProperty({enum:['LEFT','RIGHT']}) @IsIn(['LEFT','RIGHT']) side!:'LEFT'|'RIGHT';
 @ApiProperty({minimum:1}) @IsInt() @Min(1) expectedVersion!:number;
}
@ApiTags('Admin - Binary Trees') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS') @UseGuards(IdempotencyGuard)
@ApiHeader({name:'Idempotency-Key',required:true})
@Controller('admin/organization/trees')
export class BinaryTreeController {
 constructor(private readonly service:BinaryTreeService){}
 private response<T>(result:{value:T;replayed:boolean}){return {data:result.value,meta:{replayed:result.replayed}};}
 @Post() @Roles('SUPER_ADMIN') @ApiOperation({operationId:'adminCreateBinaryTree',summary:'原子建立三顆公司球及七個標準位置'})
 async create(@Req() req:{user:TreePrincipal},@Body() body:CreateTreeDto,@Headers('idempotency-key') key:string){return this.response(await this.service.create(req.user,body,key));}
 @Post(':id/settings') @Roles('SUPER_ADMIN') @ApiOperation({operationId:'adminChangeBinaryTree',summary:'更新樹名称或生命週期，保留不可變歷史'})
 async change(@Req() req:{user:TreePrincipal},@Param('id',ParseUUIDPipe) id:string,@Body() body:ChangeTreeDto,@Headers('idempotency-key') key:string){return this.response(await this.service.change(req.user,id,body,key));}
 @Post(':id/company-sponsor-confirmations') @ApiOperation({operationId:'adminConfirmTreeCompanySponsor',summary:'獨立確認公司 Sponsor 與實際序號'})
 async sponsor(@Req() req:{user:TreePrincipal},@Param('id',ParseUUIDPipe) id:string,@Body() body:ConfirmSponsorDto,@Headers('idempotency-key') key:string){return this.response(await this.service.confirmCompanySponsor(req.user,id,body,key));}
 @Post(':id/placements') @Roles('SUPER_ADMIN','QUALIFICATION_PLACEMENT_OVERRIDE')
 @ApiOperation({operationId:'adminPlaceTreeQualification',summary:'明確選擇樹內位置；不變更 Sponsor'})
 async place(@Req() req:{user:TreePrincipal},@Param('id',ParseUUIDPipe) id:string,@Body() body:PlaceTreeDto,@Headers('idempotency-key') key:string){return this.response(await this.service.place(req.user,id,body,key));}
}
