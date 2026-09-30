import {FINANCIAL_CANDIDATE_CODES} from './operations-financial-health.service';
import {Body,Controller,Get,Param,Post,Query,Req,UnauthorizedException} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {IsIn,IsInt,IsISO8601,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {OperationsWorkItemsService} from './operations-work-items.service';
class TaskDto{
 @ApiProperty() @IsUUID() commandKey!:string;
 @ApiProperty({enum:['SALES','RETURN','COMPENSATION','FULFILLMENT','PAYOUT','PAYABLE','RECOVERY']}) @IsIn(['SALES','RETURN','COMPENSATION','FULFILLMENT','PAYOUT','PAYABLE','RECOVERY']) stream!:string;
 @ApiProperty() @Matches(/^(ERP-PROJECTION|ERP-HANDOFF|PAYOUT|PAYABLE|RECOVERY)-[a-f0-9]{40}$/) reference!:string;
 @ApiProperty() @IsIn(['ERP_TRANSPORT_FAILED','ERP_RESULT_MISMATCH','ERP_OPEN_EXCEPTION','ERP_RECONCILIATION_OVERDUE','ERP_HANDOFF_OVERDUE',...FINANCIAL_CANDIDATE_CODES]) code!:string;
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) evidenceHash!:string;
 @ApiProperty({required:false}) @IsOptional() @IsInt() @Min(1) @Max(8760) thresholdHours?:number;
 @ApiProperty({required:false}) @IsOptional() @IsString() @MaxLength(2000) cursor?:string;
 @ApiProperty({required:false}) @IsOptional() @IsISO8601() asOf?:string;
 @ApiProperty({enum:['FINANCE','COMPLIANCE_AUDIT','SUPER_ADMIN']}) @IsIn(['FINANCE','COMPLIANCE_AUDIT','SUPER_ADMIN']) assigneeRole!:string;
 @ApiProperty({required:false}) @IsOptional() @IsISO8601() dueAt?:string;
}
class TransitionDto{
 @ApiProperty() @IsUUID() commandKey!:string;
 @ApiProperty({enum:['ACKNOWLEDGED','INVESTIGATING','COMPLETED','RESOLVED']}) @IsIn(['ACKNOWLEDGED','INVESTIGATING','COMPLETED','RESOLVED']) status!:string;
 @ApiProperty({enum:['OPEN','ACKNOWLEDGED','INVESTIGATING']}) @IsIn(['OPEN','ACKNOWLEDGED','INVESTIGATING']) expectedStatus!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) noteReference!:string;
}
class AssignmentDto{
 @ApiProperty() @IsUUID() commandKey!:string;
 @ApiProperty({enum:['OPEN','ACKNOWLEDGED']}) @IsIn(['OPEN','ACKNOWLEDGED']) expectedStatus!:string;
 @ApiProperty({enum:['FINANCE','COMPLIANCE_AUDIT','SUPER_ADMIN']}) @IsIn(['FINANCE','COMPLIANCE_AUDIT','SUPER_ADMIN']) assigneeRole!:string;
 @ApiProperty({nullable:true}) @IsOptional() @IsISO8601() dueAt:string|null=null;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) noteReference!:string;
}
class EnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Admin - Operations Work Items') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT') @Controller('admin/operations/control')
export class OperationsWorkItemsController{
 constructor(private readonly service:OperationsWorkItemsService){}
 private context(req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'OPERATIONS_ACTOR_REQUIRED'});return {actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()};}
 @Get('tasks') @ApiOperation({operationId:'adminOperationsControlTasks',summary:'以商業參考碼分頁讀取 ERP／財務任務，不回傳人員或來源內部識別碼'}) @ApiOkResponse({type:EnvelopeDto})
 @ApiQuery({name:'status',required:false}) @ApiQuery({name:'take',required:false,type:Number}) @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'asOf',required:false})
 tasks(@Query('status') status?:string,@Query('take') take?:string,@Query('cursor') cursor?:string,@Query('asOf') asOf?:string){return this.service.list('TASK',{status,take:take===undefined?undefined:Number(take),cursor,asOf}).then(data=>({data}));}
 @Get('exceptions') @ApiOperation({operationId:'adminOperationsControlExceptions',summary:'以商業參考碼分頁讀取 ERP／財務調查例外'}) @ApiOkResponse({type:EnvelopeDto})
 @ApiQuery({name:'status',required:false}) @ApiQuery({name:'take',required:false,type:Number}) @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'asOf',required:false})
 exceptions(@Query('status') status?:string,@Query('take') take?:string,@Query('cursor') cursor?:string,@Query('asOf') asOf?:string){return this.service.list('EXCEPTION',{status,take:take===undefined?undefined:Number(take),cursor,asOf}).then(data=>({data}));}
 @Post('tasks') @ApiOperation({operationId:'adminCreateOperationsCandidateTask',summary:'重新驗證目前候選並建立一次有指派與到期日的任務'}) @ApiOkResponse({type:EnvelopeDto})
 create(@Body() body:TaskDto,@Req() req:any){const {commandKey,...input}=body;return this.service.createTask(input,commandKey,this.context(req)).then(data=>({data}));}
 @Post('tasks/:reference/transitions') @ApiOperation({operationId:'adminTransitionOperationsControlTask',summary:'稽核任務處理狀態，不改變 ERP 或 UCell 權威事實'}) @ApiOkResponse({type:EnvelopeDto})
 taskTransition(@Param('reference') reference:string,@Body() body:TransitionDto,@Req() req:any){const {commandKey,...input}=body;return this.service.transition('TASK',reference,input,commandKey,this.context(req)).then(data=>({data}));}
 @Post('tasks/:reference/assignment') @ApiOperation({operationId:'adminAssignOperationsControlTask',summary:'稽核未完成任務的角色改派與到期日；保留來源事實'}) @ApiOkResponse({type:EnvelopeDto})
 assign(@Param('reference') reference:string,@Body() body:AssignmentDto,@Req() req:any){const {commandKey,...input}=body;return this.service.assign(reference,input,commandKey,this.context(req)).then(data=>({data}));}
 @Post('exceptions/:reference/transitions') @ApiOperation({operationId:'adminTransitionOperationsControlException',summary:'稽核調查狀態；結案前要求目前來源已對帳證據'}) @ApiOkResponse({type:EnvelopeDto})
 exceptionTransition(@Param('reference') reference:string,@Body() body:TransitionDto,@Req() req:any){const {commandKey,...input}=body;return this.service.transition('EXCEPTION',reference,input,commandKey,this.context(req)).then(data=>({data}));}
}
