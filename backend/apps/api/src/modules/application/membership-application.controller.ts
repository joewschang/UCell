import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { CreateMembershipApplicationDto } from './dto/create-membership-application.dto';
import { MembershipApplicationService } from './membership-application.service';

@ApiTags('Admin - Membership Application')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/membership-applications')
export class MembershipApplicationController {
  constructor(private readonly service:MembershipApplicationService){}


  @Get()
  @ApiOperation({operationId:'adminSearchMembershipApplications',summary:'搜尋／待審會員申請佇列'})
  async search(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ){
    return {data:await this.service.search({
      status:status || undefined,
      q:q || undefined,
      take:Number(take ?? 50),
    })};
  }

  @Post()
  @UseGuards(IdempotencyGuard)
  @ApiOperation({operationId:'adminCreateMembershipApplication',summary:'建立會員申請草稿'})
  async create(@Body() dto:CreateMembershipApplicationDto,@Headers('idempotency-key') key:string,@Req() req:any){
    const r=await this.service.create(dto,key,req.requestId,req.user?.personId);
    return {data:r.value,meta:{replayed:r.replayed}};
  }

  @Post(':id/submit')
  @UseGuards(IdempotencyGuard)
  @ApiOperation({operationId:'adminSubmitMembershipApplication',summary:'提交會員申請'})
  async submit(@Param('id') id:string,@Headers('idempotency-key') key:string,@Req() req:any){
    const r=await this.service.submit(id,key,req.requestId,req.user?.personId);
    return {data:r.value,meta:{replayed:r.replayed}};
  }

  @Post(':id/approve')
  @UseGuards(IdempotencyGuard)
  @ApiOperation({operationId:'adminApproveMembershipApplication',summary:'核准並使會員資格生效'})
  async approve(@Param('id') id:string,@Headers('idempotency-key') key:string,@Req() req:any){
    const r=await this.service.approve(id,key,req.requestId,req.user?.personId);
    return {data:r.value,meta:{replayed:r.replayed}};
  }

  @Get(':id')
  @ApiOperation({operationId:'adminGetMembershipApplication',summary:'會員申請詳情'})
  async get(@Param('id') id:string){ return {data:await this.service.get(id)}; }
}
