import {Body,Controller,Get,Header,Headers,Param,ParseUUIDPipe,Post,Query,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiTags} from '@nestjs/swagger';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {BundleRootSponsorInput,BundleSponsorQuery,EnrollmentBundleInput} from './enrollment-bundle.dto';
import {EnrollmentBundleService} from './enrollment-bundle.service';

@ApiTags('Member - Formal enrollment')
@ApiBearerAuth('memberBearer')
@UseGuards(MemberAuthenticationGuard)
@Controller('member/formal-enrollment/applications/:applicationId/bundle')
export class EnrollmentBundleController {
  constructor(private readonly bundles:EnrollmentBundleService) {}

  @Get('sponsor-candidate') @Header('Cache-Control','private, no-store')
  @ApiOperation({operationId:'memberEnrollmentSponsorCandidate',summary:'依完整推薦代碼核對此申請的推薦球與名稱'})
  async sponsorCandidate(@Req() req:any,@Param('applicationId',ParseUUIDPipe) id:string,@Query() query:BundleSponsorQuery){
    return {data:await this.bundles.sponsorCandidate(req.user.personId,id,query.code)};
  }

  @Get()
  @ApiOperation({operationId:'memberReadEnrollmentBundle',summary:'讀取本次申請的多球訂單與安置狀態'})
  async read(@Req() req:any,@Param('applicationId',ParseUUIDPipe) id:string){
    return {data:await this.bundles.read(req.user.personId,id)};
  }

  @Post() @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
  @ApiOperation({operationId:'memberCreateEnrollmentBundle',summary:'一次建立多個資格及逐球重銷訂單'})
  async create(@Req() req:any,@Param('applicationId',ParseUUIDPipe) id:string,@Body() input:EnrollmentBundleInput,
    @Headers('idempotency-key') key:string){
    const result=await this.bundles.create(req.user.personId,id,input,key,req.requestId);
    return {data:result.value,meta:{replayed:result.replayed}};
  }

  @Post('root-sponsor') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
  @ApiOperation({operationId:'memberSetEnrollmentBundleRootSponsor',summary:'為待核款的多球申請補填第一顆球的推薦球號'})
  async selectSponsor(@Req() req:any,@Param('applicationId',ParseUUIDPipe) id:string,@Body() input:BundleRootSponsorInput,
    @Headers('idempotency-key') key:string){
    const result=await this.bundles.setRootSponsor(req.user.personId,id,input.sponsorCode,key,req.requestId);
    return {data:result.value,meta:{replayed:result.replayed}};
  }

  @Post(':bundleId/release-expired') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
  @ApiOperation({operationId:'memberReleaseExpiredEnrollmentBundle',summary:'作廢未收款且已逾期的整組訂單以重新選購'})
  async release(@Req() req:any,@Param('applicationId',ParseUUIDPipe) id:string,@Param('bundleId',ParseUUIDPipe) bundleId:string,
    @Headers('idempotency-key') key:string){
    const result=await this.bundles.release(req.user.personId,id,bundleId,key,req.requestId);
    return {data:result.value,meta:{replayed:result.replayed}};
  }
}
