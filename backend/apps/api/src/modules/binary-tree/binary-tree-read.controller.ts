import {Type} from 'class-transformer';
import {Controller,Get,Header,Param,ParseUUIDPipe,Query,Req,UnprocessableEntityException} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiProperty,ApiPropertyOptional,ApiTags} from '@nestjs/swagger';
import {IsIn,IsOptional,IsString,IsUUID,IsInt,Matches,Min} from 'class-validator';
import {Roles} from '../auth/roles.decorator';
import {BinaryTreeReadService} from './binary-tree-read.service';
import {TreePrincipal,BinaryTreeService} from './binary-tree.service';
class TreeTimeQuery {
 @ApiProperty({enum:['Asia/Taipei']}) @IsIn(['Asia/Taipei']) timezone!:'Asia/Taipei';
 @ApiProperty({format:'date-time'}) @IsString() asOf!:string;
 @ApiProperty({format:'date-time'}) @IsString() periodStart!:string;
 @ApiProperty({format:'date-time'}) @IsString() periodEnd!:string;
 @ApiProperty({format:'date-time'}) @IsString() knowledgeCutoff!:string;
}
class TreeListQuery extends TreeTimeQuery {
 @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() after?:string;
}
class TreeNodeQuery extends TreeListQuery {
 @ApiPropertyOptional({format:'uuid',description:'Expand direct children within the same tree-wide snapshot; never downloads the entire tree.'}) @IsOptional() @IsUUID() parentQualificationId?:string;
 @ApiPropertyOptional({format:'uuid',description:'First-page snapshot identity, required with after; bound to actor, role, tree and time. Conflict/expiry: 409.'}) @IsOptional() @IsUUID() snapshotToken?:string;
}
class TreePreviewQuery {
 @ApiPropertyOptional({format:'uuid',description:'Legacy technical identifier. Prefer qualificationMemberNo.'}) @IsOptional() @IsUUID() qualificationId?:string;
 @ApiPropertyOptional({description:'Public Member Number for the single unplaced Member-origin qualification.'}) @IsOptional() @Matches(/^\d{10}$/) qualificationMemberNo?:string;
 @ApiPropertyOptional({format:'uuid',description:'Legacy technical identifier. Prefer binaryParentBallNo.'}) @IsOptional() @IsUUID() binaryParentQualificationId?:string;
 @ApiPropertyOptional({description:'Immutable public Ball Number of the parent within this Tree.'}) @IsOptional() @IsString() binaryParentBallNo?:string;
 @ApiProperty({enum:['LEFT','RIGHT']}) @IsIn(['LEFT','RIGHT']) side!:'LEFT'|'RIGHT';
 @ApiProperty() @Type(()=>Number) @IsInt() @Min(1) expectedVersion!:number;
}
@ApiTags('Admin - Binary Trees') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','QUALIFICATION_PLACEMENT_OVERRIDE','COMPLIANCE_AUDIT')
@Controller('admin/organization/trees')
export class BinaryTreeReadController {
 constructor(private readonly service:BinaryTreeReadService,private readonly commands:BinaryTreeService){}
 @Get() @Header('Cache-Control','no-store') @ApiOperation({operationId:'adminListBinaryTrees',summary:'依指定時間與記錄截點列出樹'})
 async list(@Req() req:{user:TreePrincipal},@Query() input:TreeListQuery){const {after,...time}=input;return {data:await this.service.list(req.user,time,after)};}
 @Get(':id') @Header('Cache-Control','no-store') @ApiOperation({operationId:'adminReadBinaryTree',summary:'讀取樹與七個標準位置的非金額歷史統計'})
 async detail(@Req() req:{user:TreePrincipal},@Param('id',ParseUUIDPipe) id:string,@Query() time:TreeTimeQuery){return {data:await this.service.detail(req.user,id,{...time})};}
 @Get(':id/nodes') @Header('Cache-Control','no-store') @ApiOperation({operationId:'adminReadBinaryTreeNodes',summary:'分頁讀取指定時間的完整樹節點；總數不受頁面上限限制'})
 async nodes(@Req() req:{user:TreePrincipal},@Param('id',ParseUUIDPipe) id:string,@Query() input:TreeNodeQuery){const {after,snapshotToken,parentQualificationId,...time}=input;return {data:await this.service.nodes(req.user,id,time,after,snapshotToken,parentQualificationId)};}
 @Get(':id/placement-preview') @Header('Cache-Control','no-store') @ApiOperation({operationId:'adminPreviewTreePlacement',summary:'預檢實際 Sponsor 與指定位置，回傳版本綁定 token'})
 async preview(@Req() req:{user:TreePrincipal},@Param('id',ParseUUIDPipe) id:string,@Query() input:TreePreviewQuery){
  const binaryParentQualificationId=input.binaryParentBallNo?await this.commands.resolveTreeBall(req.user,id,input.binaryParentBallNo):input.binaryParentQualificationId;
  if(!binaryParentQualificationId)throw new UnprocessableEntityException({code:'BINARY_PARENT_BALL_REQUIRED'});
  const qualificationId=input.qualificationMemberNo?await this.commands.resolveUnplacedMemberQualification(req.user,input.qualificationMemberNo):input.qualificationId;
  if(!qualificationId)throw new UnprocessableEntityException({code:'QUALIFICATION_MEMBER_NO_REQUIRED'});
  return {data:await this.commands.preview(req.user,id,{...input,qualificationId,binaryParentQualificationId})};
 }
}
