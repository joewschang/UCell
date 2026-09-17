import { Roles } from '../auth/roles.decorator';
import { Controller,Get } from '@nestjs/common';
import { ApiBearerAuth,ApiOkResponse,ApiOperation,ApiTags } from '@nestjs/swagger';
import { AdminDashboardService } from './admin-dashboard.service';

const unavailableDashboardMetricSchema={type:'object' as const,required:['availability','value','reasonCode'],properties:{availability:{type:'string' as const,enum:['UNAVAILABLE']},value:{type:'string' as const,nullable:true,example:null},reasonCode:{type:'string' as const}}};

@ApiTags('Admin - Dashboard')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT','CUSTOMER_SERVICE')
@Controller('admin/dashboard')
export class AdminDashboardController{
  constructor(private readonly service:AdminDashboardService){}
  @Get('summary')
  @ApiOperation({operationId:'adminDashboardSummary',summary:'管理後台營運摘要Read Model'})
  @ApiOkResponse({description:'Authoritative operational counts. NASL fields remain explicitly unavailable until their aggregation policy is approved.',schema:{type:'object',required:['data'],properties:{data:{type:'object',required:['generatedAt','persons','qualifications','activeQualifications','memberLifecycle','ruleVersionCode'],properties:{generatedAt:{type:'string',format:'date-time'},persons:{type:'integer'},qualifications:{type:'integer'},activeQualifications:{type:'integer'},memberLifecycle:{type:'object',required:['nasl','currentPersonRecordStatus','currentQualificationLifecycleStatus'],properties:{nasl:{type:'object',description:'Person NASL aggregation is not inferred from record or Qualification status.',properties:{new:unavailableDashboardMetricSchema,active:unavailableDashboardMetricSchema,suspended:unavailableDashboardMetricSchema,lost:unavailableDashboardMetricSchema}},currentPersonRecordStatus:{type:'object',properties:{availability:{type:'string',enum:['AVAILABLE']},source:{type:'string',example:'identity.person.status'},counts:{type:'object',additionalProperties:{type:'integer'}}}},currentQualificationLifecycleStatus:{type:'object',properties:{availability:{type:'string',enum:['AVAILABLE']},source:{type:'string',example:'membership.qualification.status'},counts:{type:'object',additionalProperties:{type:'integer'}}}}}},ruleVersionCode:{type:'string'}}}}}})
  summary(){return this.service.summary().then(data=>({data}));}
}
