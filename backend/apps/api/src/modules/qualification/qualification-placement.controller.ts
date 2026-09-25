import {Body,Controller,Get,Headers,Param,ParseUUIDPipe,Post,Query,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiProperty,ApiPropertyOptional,ApiTags} from '@nestjs/swagger';
import {IsEnum,IsOptional,IsString,IsUUID,Matches,MaxLength,MinLength} from 'class-validator';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {Roles} from '../auth/roles.decorator';
import {QualificationPlacementService} from './qualification-placement.service';

class PlaceQualificationDto { @ApiProperty({format:'uuid'}) @IsUUID() binaryParentQualificationId!:string; @ApiProperty({enum:['LEFT','RIGHT']}) @IsEnum(['LEFT','RIGHT']) side!:'LEFT'|'RIGHT'; }
class AdminPlaceQualificationDto extends PlaceQualificationDto { @ApiProperty({maxLength:120}) @IsString() @MinLength(1) @MaxLength(120) reasonCode!:string; }
class MemberPlaceQualificationDto { @ApiProperty({pattern:'^[A-Z][A-Z0-9]{5,58}$',description:'Public parent Ball number. UUIDs are not accepted in the member flow.'}) @Matches(/^[A-Z][A-Z0-9]{5,58}$/) binaryParentBallNo!:string; @ApiProperty({enum:['LEFT','RIGHT']}) @IsEnum(['LEFT','RIGHT']) side!:'LEFT'|'RIGHT'; }

@ApiTags('Member - Qualification Placement') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard)
@Controller('member')
export class MemberQualificationPlacementController {
 constructor(private readonly service:QualificationPlacementService){}
 @Get('placements/pending') @ApiOperation({operationId:'memberPendingQualificationPlacements',description:'Balls awaiting placement for which the authenticated Person owns the confirmed Sponsor Ball.'}) pending(@Req() req:any){return this.service.pendingForSponsorOwner(req.user.personId);}
 @Post('placements/pending/:placementReference/place') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberPlaceQualification',description:'Serializable placement commit using an opaque pending-placement reference and public parent Ball number; Sponsor owner authorization and Binary legality are revalidated server-side.'}) place(@Req() req:any,@Param('placementReference') placementReference:string,@Body() body:MemberPlaceQualificationDto,@Headers('idempotency-key') key:string){return this.service.placeBySponsorOwnerBallNo(req.user.personId,{placementReference,...body},key,req.requestId);}
}

@ApiTags('Admin - Qualification Placement') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/qualification-placements')
export class AdminQualificationPlacementController {
 constructor(private readonly service:QualificationPlacementService){}
 @Get() @ApiOperation({operationId:'adminQualificationPlacementMonitor'}) monitor(@Query('status') status?:string,@Query('aging') aging?:string,@Query('take') take?:string){return this.service.monitor({status:status||undefined,aging:aging||undefined,take:Number(take??50)});}
 @Post('sweep-overdue') @Roles('SUPER_ADMIN','QUALIFICATION_PLACEMENT_OVERRIDE') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'adminSweepOverdueQualificationPlacements'}) sweep(@Req() req:any,@Headers('idempotency-key') key:string){return this.service.sweepOverdue(req.user?.personId,key,req.requestId);}
 @Post(':id/place') @Roles('SUPER_ADMIN','QUALIFICATION_PLACEMENT_OVERRIDE') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'adminOverrideQualificationPlacement',description:'Requires explicit placement override role and reason. Same legality/concurrency checks as Sponsor owner placement.'}) place(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:AdminPlaceQualificationDto,@Headers('idempotency-key') key:string){return this.service.placeByAdmin(req.user?.personId,{qualificationId:id,...body},key,req.requestId);}
}
