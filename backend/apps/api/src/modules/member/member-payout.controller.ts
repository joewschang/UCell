import {Controller,Get,Query,Req,UseGuards} from '@nestjs/common';
import {ApiProperty,ApiPropertyOptional,ApiExtraModels,ApiResponse,ApiOperation,ApiBearerAuth,ApiTags} from '@nestjs/swagger';
import {IsUUID,IsOptional,IsInt,Min,Max,IsDateString} from 'class-validator';
import {Type} from 'class-transformer';
import {MemberReadService} from './member-read.service';
import {MemberPayoutView,MemberPaymentResultView} from './member-payout.dto';
import {memberEnvelope} from './member-view.dto';
import {MemberContextGuard} from './member-context.guard';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
class MemberPayoutQueryDto{
 @ApiProperty({format:'uuid'}) @IsUUID() qualificationId!:string;
 @ApiPropertyOptional({minimum:0,maximum:1000000}) @IsOptional() @Type(()=>Number) @IsInt() @Min(0) @Max(1000000) offset?:number;
 @ApiPropertyOptional({format:'date-time'}) @IsOptional() @IsDateString() asOf?:string;
}
@ApiTags('Member') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard,MemberContextGuard)
@ApiExtraModels(MemberPayoutView,MemberPaymentResultView)
@Controller('member')
export class MemberPayoutController{
 constructor(private readonly reads:MemberReadService){}
 @Get('payouts') @ApiResponse({status:200,schema:memberEnvelope(MemberPayoutView)})
 @ApiResponse({status:400,description:'Invalid pagination/query; unknown fields rejected'}) @ApiResponse({status:401,description:'Authenticated Member session required'}) @ApiResponse({status:403,description:'Selected Qualification not held'}) @ApiResponse({status:422,description:'Qualification context required'})
 @ApiOperation({operationId:'memberPayoutResults',description:'Own current Qualification payment-result history; decimal strings, safe references and creation-time pagination. No bank identifiers or transfer initiation.'})
 payouts(@Req() req:any,@Query() q:MemberPayoutQueryDto){return this.reads.payouts(req.user.personId,q.qualificationId,q);}
}
