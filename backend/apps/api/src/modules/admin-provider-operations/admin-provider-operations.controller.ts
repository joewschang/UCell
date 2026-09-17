import { Body,Controller,Get,Headers,HttpCode,Param,Post,Query,Req,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiOkResponse,ApiOperation,ApiParam,ApiProperty,ApiResponse,ApiTags } from '@nestjs/swagger';
import { IsString,MaxLength,MinLength } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminProviderOperationsService } from './admin-provider-operations.service';

export class RetryProviderWebhookDto { @ApiProperty({minLength:10,maxLength:500}) @IsString() @MinLength(10) @MaxLength(500) reason!:string; }

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

  @Post(':id/retry')
  @HttpCode(200)
  @Roles('SUPER_ADMIN')
  @UseGuards(IdempotencyGuard)
  @ApiParam({name:'id',format:'uuid'})
  @ApiOperation({operationId:'adminRetryProviderWebhook',summary:'Governed requeue from MANUAL_REVIEW; worker must acquire a new lease before processing'})
  @ApiResponse({status:200,description:'Scheduled for governed worker retry, or exact idempotent replay'})
  @ApiResponse({status:400,description:'Invalid webhook id or Idempotency-Key'})
  @ApiResponse({status:401,description:'Admin authentication required'})
  @ApiResponse({status:403,description:'SUPER_ADMIN role and actor identity required'})
  @ApiResponse({status:404,description:'Webhook Inbox row not found'})
  @ApiResponse({status:409,description:'Idempotency conflict, state changed, or concurrent retry conflict'})
  @ApiResponse({status:422,description:'Operator reason is missing or invalid'})
  retry(@Param('id') id:string,@Body() body:RetryProviderWebhookDto,@Headers('idempotency-key') key:string,@Req() req:any){
    const actorKey=req.user?.personId??req.user?.subject;
    return this.service.retryManualReview(id,body.reason,key,actorKey,req.user?.personId,req.requestId,req.correlationId??randomUUID()).then(data=>({data}));
  }
}
