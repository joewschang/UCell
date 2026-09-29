import {Body,Controller,Get,Param,ParseUUIDPipe,Post,Query,Req,UsePipes,ValidationPipe,UnauthorizedException,NotFoundException,ConflictException,BadRequestException} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiTags} from '@nestjs/swagger';
import {ArrayMaxSize,IsArray,IsIn,IsISO8601,IsInt,IsOptional,IsString,IsUUID,Length,Max,Min} from 'class-validator';
import {Type} from 'class-transformer';
import {PrismaService,enqueuePeriodCloseJob,PeriodCloseKind} from '@ucell/database';
import {SettlementCalendarService} from '@ucell/settlement';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {AuditService} from '../../common/audit/audit.service';

export class CreateSettlementJobDto {
  @IsIn(['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL']) kind!:PeriodCloseKind;
  @IsISO8601({strict:true}) periodStart!:string;
  @IsISO8601({strict:true}) periodEnd!:string;
  @IsString() @Length(1,100) ruleVersionCode!:string;
  @IsArray() @ArrayMaxSize(100) @IsUUID('all',{each:true}) prerequisiteIds!:string[];
  @IsString() @Length(1,200) approvalReference!:string;
}
export class ListSettlementJobsDto {
  @IsOptional() @IsIn(['PENDING','PROCESSING','PROCESSED','DEAD']) status?:'PENDING'|'PROCESSING'|'PROCESSED'|'DEAD';
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(200) take=50;
}
export class RetrySettlementJobDto {@IsString() @Length(3,500) reason!:string;}
@ApiTags('Admin - Settlement Jobs')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/settlement-jobs')
export class SettlementJobsController {
  constructor(private readonly db:PrismaService,private readonly calendar:SettlementCalendarService,private readonly audit:AuditService){}
  @Post()
  @Roles('SUPER_ADMIN','FINANCE')
  @ApiOperation({operationId:'adminCreateSettlementJob',summary:'建立可追蹤的結算工作'})
  @UsePipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}))
  async create(@Body() body:CreateSettlementJobDto,@Req() req:any){
    const actor=req.user?.personId;
    if(!actor)throw new UnauthorizedException('AUTHENTICATED_ACTOR_REQUIRED');
    const start=new Date(body.periodStart),end=new Date(body.periodEnd);
    const job=await enqueuePeriodCloseJob(this.db,{...body,periodStart:start,periodEnd:end,requestedBy:actor},tx=>this.calendar.captureForPeriod(tx,start,end,body.kind,body.ruleVersionCode),
      (tx,row)=>this.audit.write(tx,{actorType:'USER',actorId:actor,actorRoleSnapshot:req.user.role,action:'PERIOD_CLOSE_REQUESTED',entityType:'PeriodCloseJob',entityId:row.periodCloseJobId,afterData:{kind:row.kind,periodStart:start,periodEnd:end,ruleVersionCode:row.ruleVersionCode,prerequisiteIds:body.prerequisiteIds,approvalReference:body.approvalReference},requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()})).catch(error=>{
        if(error.message==='PERIOD_CLOSE_REQUEST_CONFLICT')throw new ConflictException(error.message);
        if(['PERIOD_CLOSE_REQUEST_INVALID','PERIOD_CLOSE_PREREQUISITE_INVALID','PERIOD_CLOSE_BINARY_REQUIRED','PERIOD_CLOSE_RULE_MISMATCH'].includes(error.message))throw new BadRequestException(error.message);
        throw error;
      });
    return this.get(job.periodCloseJobId);
  }
  @Get()
  @ApiOperation({operationId:'adminListSettlementJobs',summary:'列出近期結算工作與執行狀態'})
  @UsePipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}))
  async list(@Query() query:ListSettlementJobsDto){
    const rows=await this.db.periodCloseJob.findMany({where:query.status?{outbox:{processStatus:query.status}}:undefined,include:{receipt:true,outbox:true},orderBy:{createdAt:'desc'},take:query.take});
    return {data:rows.map(row=>this.view(row))};
  }
  @Get(':id')
  @ApiOperation({operationId:'adminGetSettlementJob',summary:'查看結算工作與完成憑證'})
  async get(@Param('id',ParseUUIDPipe) id:string){
    const row=await this.db.periodCloseJob.findUnique({where:{periodCloseJobId:id},include:{receipt:true,outbox:true}});
    if(!row)throw new NotFoundException('PERIOD_CLOSE_JOB_NOT_FOUND');
    return {data:this.view(row)};
  }
  @Post(':id/retry')
  @Roles('SUPER_ADMIN','FINANCE')
  @ApiOperation({operationId:'adminRetrySettlementJob',summary:'重新排程失敗或等待中的結算工作'})
  @UsePipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}))
  async retry(@Param('id',ParseUUIDPipe) id:string,@Body() body:RetrySettlementJobDto,@Req() req:any){
    const actor=req.user?.personId;if(!actor)throw new UnauthorizedException('AUTHENTICATED_ACTOR_REQUIRED');
    await this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT period_close_job_id FROM integration.period_close_job WHERE period_close_job_id=${id}::uuid FOR UPDATE`;
      const row=await tx.periodCloseJob.findUnique({where:{periodCloseJobId:id},include:{receipt:true,outbox:true}});
      if(!row)throw new NotFoundException('PERIOD_CLOSE_JOB_NOT_FOUND');
      if(row.receipt||row.outbox.processStatus==='PROCESSED')throw new ConflictException('PERIOD_CLOSE_ALREADY_COMPLETED');
      if(row.outbox.processStatus==='PROCESSING'&&row.outbox.availableAt>new Date())throw new ConflictException('PERIOD_CLOSE_JOB_LEASE_ACTIVE');
      await tx.outboxEvent.update({where:{outboxEventId:row.outboxEventId},data:{processStatus:'PENDING',availableAt:new Date(),lastError:null}});
      await this.audit.write(tx,{actorType:'USER',actorId:actor,actorRoleSnapshot:req.user.role,action:'PERIOD_CLOSE_RETRY_REQUESTED',entityType:'PeriodCloseJob',entityId:id,afterData:{reason:body.reason,priorStatus:row.outbox.processStatus,attemptCount:row.outbox.attemptCount},requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()});
    },{isolationLevel:'Serializable'});
    return this.get(id);
  }
  private view(row:any){return {id:row.periodCloseJobId,kind:row.kind,periodStart:row.periodStart,periodEnd:row.periodEnd,ruleVersionCode:row.ruleVersionCode,prerequisiteIds:row.prerequisiteIds,approvalReference:row.approvalReference,requestedBy:row.requestedBy,createdAt:row.createdAt,status:row.outbox.processStatus,attemptCount:row.outbox.attemptCount,availableAt:row.outbox.availableAt,lastError:row.outbox.lastError,completedAt:row.receipt?.completedAt??null,receipt:row.receipt};}
}
