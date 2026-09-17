import { Controller,Get,Query } from '@nestjs/common';
import { ApiBearerAuth,ApiOkResponse,ApiOperation,ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { AdminProviderOperationsService } from './admin-provider-operations.service';

@ApiTags('Admin - Provider Operations')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/provider-operations/webhooks')
export class AdminProviderOperationsController {
  constructor(private readonly service:AdminProviderOperationsService){}

  @Get('health')
  @ApiOperation({operationId:'adminProviderWebhookHealth',summary:'Provider webhook inbox health and backlog counts'})
  @ApiOkResponse({schema:{type:'object',required:['data'],properties:{data:{type:'object',required:['generatedAt','state','total','dueBacklog','expiredLeases','manualReview','oldestDueReceivedAt','counts'],properties:{generatedAt:{type:'string',format:'date-time'},state:{type:'string',enum:['HEALTHY','DEGRADED','CRITICAL']},total:{type:'integer'},dueBacklog:{type:'integer'},expiredLeases:{type:'integer'},manualReview:{type:'integer'},oldestDueReceivedAt:{type:'string',format:'date-time',nullable:true},counts:{type:'object'}}}}}})
  health(){return this.service.health().then(data=>({data}));}

  @Get('backlog')
  @ApiOperation({operationId:'adminProviderWebhookBacklog',summary:'Provider webhook operational backlog without payload or verification evidence'})
  @ApiOkResponse({schema:{type:'object',required:['data'],properties:{data:{type:'object',required:['generatedAt','items','limit','truncated'],properties:{generatedAt:{type:'string',format:'date-time'},items:{type:'array',items:{type:'object'}},limit:{type:'integer'},truncated:{type:'boolean'}}}}}})
  backlog(@Query('domain') domain?:string,@Query('provider') provider?:string,@Query('status') status?:string,@Query('take') take?:string){
    return this.service.backlog({domain,provider,status,take:take===undefined?undefined:Number(take)}).then(data=>({data}));
  }
}
