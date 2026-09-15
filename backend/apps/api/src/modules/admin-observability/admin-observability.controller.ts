import { Roles } from '../auth/roles.decorator';
import { Controller,Get,Param,Query } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiTags } from '@nestjs/swagger';
import { AdminObservabilityService } from './admin-observability.service';

@ApiTags('Admin - Organization & Compensation Observability')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN')
@Controller('admin/observability')
export class AdminObservabilityController{
  constructor(private readonly service:AdminObservabilityService){}

  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','FINANCE','COMPLIANCE_AUDIT')
  @Get('organization/sponsor-tree/:rootQualificationId')
  @ApiOperation({operationId:'adminSponsorTree',summary:'推薦樹視圖'})
  sponsorTree(
    @Param('rootQualificationId') id:string,
    @Query('depth') depth?:string,
    @Query('at') at?:string
  ){
    return this.service.sponsorTree(id,Number(depth??4),at?new Date(at):new Date())
      .then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','FINANCE','COMPLIANCE_AUDIT')
  @Get('organization/binary-tree/:rootQualificationId')
  @ApiOperation({operationId:'adminBinaryTree',summary:'二元樹視圖'})
  binaryTree(
    @Param('rootQualificationId') id:string,
    @Query('depth') depth?:string,
    @Query('at') at?:string
  ){
    return this.service.binaryTree(id,Number(depth??5),at?new Date(at):new Date())
      .then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','FINANCE','COMPLIANCE_AUDIT')
  @Get('qualifications/:qualificationId/operations')
  @ApiOperation({operationId:'adminQualificationOperations',summary:'Qualification Active/PV/Award/Carry營運視圖'})
  operations(@Param('qualificationId') id:string){
    return this.service.qualificationOperations(id).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('awards/:bonusAwardId')
  @ApiOperation({operationId:'adminAwardDetail',summary:'獎金來源、K值、生命週期、Recovery與Payable Drill-down'})
  award(@Param('bonusAwardId') id:string){
    return this.service.awardDetail(id).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('settlements')
  @ApiOperation({operationId:'adminSettlementHistory',summary:'K0/K1/K2 Settlement歷史與池壓縮'})
  settlements(
    @Query('type') type?:'REFERRAL_K0'|'BINARY_K1'|'MATCHING_K2',
    @Query('take') take?:string
  ){
    return this.service.settlementHistory({settlementType:type,take:Number(take??50)})
      .then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('pools')
  @ApiOperation({operationId:'adminPoolHistory',summary:'Global/Welfare Pool歷史'})
  pools(@Query('take') take?:string){
    return this.service.poolHistory(Number(take??24)).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('compensation/summary')
  @ApiOperation({operationId:'adminCompensationSummary',summary:'獎金/結算/Recovery營運摘要'})
  summary(){return this.service.compensationSummary().then(data=>({data}));}
}
