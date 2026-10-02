import {Controller,Get,Post,Param,ParseUUIDPipe,Req,Headers,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiTags} from '@nestjs/swagger';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {FormalEnrollmentService} from './formal-enrollment.service';
@ApiTags('Member - Formal enrollment') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard)
@Controller('member/formal-enrollment')
export class FormalEnrollmentController{
 constructor(private readonly enrollment:FormalEnrollmentService){}
 @Get() @ApiOperation({operationId:'memberFormalEnrollment',summary:'正式會員升級狀態與申請費'}) status(@Req() req:any){return this.enrollment.status(req.user.personId);}
 @Post('fee-payment') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'memberStageFormalEnrollmentFee',summary:'Stage 模擬支付 600 元正式會員申請費',description:'Stage database/environment allowlist only. Server-fixed fee, one payment per member, no Qualification or approval.'})
 fee(@Req() req:any,@Headers('idempotency-key') key:string){return this.enrollment.payFee(req.user.personId,key,req.requestId);}
 @Post('package-payments/:id') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'memberStageFormalEnrollmentPackagePayment',summary:'Stage 模擬支付本人資格套組',description:'Owned formal-eligibility package only. Uses canonical order payment writer; no extra 600 fee and no automatic formal approval.'})
 package(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string,@Headers('idempotency-key') key:string){return this.enrollment.payPackage(req.user.personId,id,key,req.requestId);}
 @Post('applications/:id/submit') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'memberSubmitFormalEnrollment',summary:'送出已付款且附文件的正式會員申請',description:'Own encrypted application only. Payment and required files must exist. Submission grants neither malware clearance, formal approval nor Qualification.'})
 submit(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string,@Headers('idempotency-key') key:string){return this.enrollment.submit(req.user.personId,id,key,req.requestId);}
}
