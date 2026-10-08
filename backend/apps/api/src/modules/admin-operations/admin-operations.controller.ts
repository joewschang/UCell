import { Roles } from '../auth/roles.decorator';
import { Body,Controller,Get,Headers,Param,Post,Query,Req,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiHeader,ApiOperation,ApiTags,ApiProperty,ApiQuery } from '@nestjs/swagger';
import {IsInt,Min,Max,IsString,IsIn,IsArray,ArrayMinSize,ArrayMaxSize,ValidateNested,IsOptional,MaxLength,Matches} from 'class-validator';
import {Type} from 'class-transformer';
import { randomUUID } from 'crypto';
import { AdminOperationsService } from './admin-operations.service';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
class PayoutArtifactDownloadDto{
  @ApiProperty({minimum:1,maximum:2147483647}) @IsInt() @Min(1) @Max(2147483647) revision!:number;
}
class BankRecipientDto{
  @ApiProperty() @IsString() @MaxLength(100) payoutLineId!:string;
  @ApiProperty({maxLength:40}) @IsString() @MaxLength(40) accountName!:string;
  @ApiProperty({description:'Digit string preserving leading zeros'}) @IsString() @Matches(/^\d{1,16}$/) accountNumber!:string;
  @ApiProperty({required:false}) @IsOptional() @IsString() @Matches(/^\d{7}$/) bankBranchCode?:string;
  @ApiProperty({required:false}) @IsOptional() @IsString() @Matches(/^[A-Za-z0-9]{4}$/) reference?:string;
  @ApiProperty({required:false,maxLength:40}) @IsOptional() @IsString() @MaxLength(40) remark?:string;
}
class BankExportDto{
  @ApiProperty({enum:['BULK_REMITTANCE','CENTER_TRANSFER']}) @IsIn(['BULK_REMITTANCE','CENTER_TRANSFER']) format!:'BULK_REMITTANCE'|'CENTER_TRANSFER';
  @ApiProperty({maxLength:200}) @IsString() @MaxLength(200) exportReference!:string;
  @ApiProperty({type:[BankRecipientDto]}) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(999) @ValidateNested({each:true}) @Type(()=>BankRecipientDto) recipients!:BankRecipientDto[];
}

@ApiTags('Admin - Returns / Workflows / Payout Operations')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN')
@Controller('admin/operations')
export class AdminOperationsController{
  constructor(private readonly service:AdminOperationsService){}

  @Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
  @Get('returns')
  @ApiOperation({operationId:'adminReturnQueue',summary:'退貨/反向/Replay營運佇列'})
  returns(@Query('status') status?:string,@Query('q') q?:string,@Query('take') take?:string){
    return this.service.returns({status,q,take:Number(take??50)}).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
  @Get('returns/:id')
  @ApiOperation({operationId:'adminReturnDetail',summary:'退貨、GPV反向、Recovery、Replay完整追蹤'})
  returnDetail(@Param('id') id:string){
    return this.service.returnDetail(id).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
  @Get('workflows')
  @ApiOperation({operationId:'adminWorkflowQueue',summary:'升級/轉讓/退出/公司再轉讓佇列'})
  workflows(
    @Query('status') status?:string,@Query('type') type?:string,
    @Query('q') q?:string,@Query('take') take?:string
  ){
    return this.service.workflows({status,type,q,take:Number(take??50)}).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
  @Get('workflows/:id')
  @ApiOperation({operationId:'adminWorkflowDetail',summary:'Qualification異動Workflow詳情'})
  workflowDetail(@Param('id') id:string){
    return this.service.workflowDetail(id).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','FINANCE','COMPLIANCE_AUDIT')
  @Get('members/:memberNo/timeline')
  @ApiOperation({operationId:'adminReadMemberActivityTimelineByMemberNo',summary:'以 memberNo 重建授權的會員活動時間線'} )
  memberTimeline(@Param('memberNo') memberNo:string,@Query('take') take?:string){
    return this.service.memberActivityTimeline(memberNo,{take:Number(take??100)}).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('recoveries')
  @ApiOperation({operationId:'adminRecoveryAging',summary:'Recovery Aging與抵扣履歷'})
  recoveries(@Query('status') status?:string,@Query('q') q?:string,@Query('take') take?:string){
    return this.service.recoveries({status,q,take:Number(take??100)}).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('payout-batches')
  @ApiOperation({operationId:'adminPayoutBatchQueue',summary:'付款批次Queue'})
  payouts(@Query('status') status?:string,@Query('take') take?:string){
    return this.service.payoutBatches({status,take:Number(take??50)}).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('payout-batches/:id')
  @ApiOperation({operationId:'adminPayoutBatchDetail',summary:'付款批次與Qualification明細'})
  payoutDetail(@Param('id') id:string){
    return this.service.payoutBatchDetail(id).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT','ORDER_OPS')
  @Get('economic-lineage/orders/:orderNo')
  @ApiOperation({operationId:'adminReadEconomicLineageByOrderNo',summary:'以 orderNo 讀取既有不可變經濟與履約來源鏈'})
  economicLineage(@Param('orderNo') orderNo:string){
    return this.service.economicLineageByOrderNo(orderNo).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','FINANCE','COMPLIANCE_AUDIT')
  @Get('members/:memberNo/360')
  @ApiOperation({operationId:'adminReadMember360ByMemberNo',summary:'以 memberNo 讀取授權的 Member 360 事實投影'} )
  member360(@Param('memberNo') memberNo:string){return this.service.member360(memberNo).then(data=>({data}));}

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('invariant-candidates')
  @ApiOperation({operationId:'adminOperationalInvariantCandidates',summary:'讀取可稽核的營運不變量候選，不修改來源資料'} )
  @ApiQuery({name:'thresholdHours',required:false,schema:{type:'integer',minimum:1,maximum:8760},description:'Explicit operational threshold for incomplete period jobs; omit to assess only failure and evidence invariants.'})
  invariantCandidates(@Query('take') take?:string,@Query('thresholdHours') thresholdHours?:string){return this.service.invariantCandidates({take:Number(take??100),thresholdHours:thresholdHours===undefined?undefined:Number(thresholdHours)}).then(data=>({data}));}

  @Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT')
  @Get('exceptions')
  @ApiOperation({operationId:'adminOperationalExceptionQueue',summary:'營運例外唯讀佇列'})
  exceptions(@Query('status') status?:string,@Query('take') take?:string){return this.service.operationalExceptions({status,take:Number(take??100)}).then(data=>({data}));}

  @Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT')
  @Post('exceptions/:id/:status')
  @ApiOperation({operationId:'adminTransitionOperationalException',summary:'記錄營運例外調查狀態；不修改來源領域資料'})
  transitionException(@Param('id') id:string,@Param('status') status:'ACKNOWLEDGED'|'INVESTIGATING'|'RESOLVED',@Body() body:{note?:string},@Req() req:any){return this.service.transitionOperationalException(id,status,req.user?.personId,body?.note,req.requestId,req.correlationId??randomUUID()).then(data=>({data}));}

  @Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT')
  @Get('tasks')
  @ApiOperation({operationId:'adminOperationalTaskQueue',summary:'營運任務唯讀佇列'} )
  tasks(@Query('status') status?:string,@Query('take') take?:string){return this.service.operationalTasks({status,take:Number(take??100)}).then(data=>({data}));}

  @Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT')
  @Post('tasks') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
  @ApiOperation({operationId:'adminCreateOperationalTask',summary:'建立不改變來源工作流的營運任務'} )
  createTask(@Body() body:{sourceType:string;sourceId:string;taskCode:string;summary:string;priority?:string;assigneeActor?:string;assigneeRole?:string;dueAt?:string;evidenceHash?:string;traceId?:string},@Headers('idempotency-key') key:string,@Req() req:any){return this.service.createOperationalTask(body,req.user?.personId,key,req.requestId,req.correlationId??randomUUID()).then(data=>({data}));}

  @Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT')
  @Post('tasks/:id/:status')
  @ApiOperation({operationId:'adminTransitionOperationalTask',summary:'記錄營運任務處置；不修改來源領域資料'} )
  transitionTask(@Param('id') id:string,@Param('status') status:'ACKNOWLEDGED'|'COMPLETED',@Body() body:{note?:string},@Req() req:any){return this.service.transitionOperationalTask(id,status,req.user?.personId,body?.note,req.requestId,req.correlationId??randomUUID()).then(data=>({data}));}

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Post('payout-batches/:id/approvals/:stage')
  @ApiOperation({operationId:'adminApprovePayoutStage',summary:'Finance/Compliance雙階段付款審核'})
  approve(
    @Param('id') id:string,
    @Param('stage') stage:'FINANCE_REVIEW'|'COMPLIANCE_REVIEW',
    @Body() body:{note?:string},
    @Req() req:any
  ){
    return this.service.approvePayout(
      id,stage,req.user?.personId,req.user?.role,body?.note,
      req.requestId,req.correlationId??randomUUID()
    ).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Post('payout-batches/:id/export')
  @ApiOperation({operationId:'adminExportPayoutBatch',summary:'雙核准後標記已匯出付款檔'})
  export(
    @Param('id') id:string,@Body() body:{exportReference:string},@Req() req:any
  ){
    return this.service.exportPayout(
      id,body.exportReference,req.user?.personId,req.user?.role,req.requestId,
      req.correlationId??randomUUID()
    ).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE')
  @Post('payout-batches/:id/mark-paid')
  @ApiOperation({operationId:'adminMarkPayoutPaid',summary:'記錄外部付款/銀行對帳結果；本系統不直接執行銀行轉帳'})
  paid(
    @Param('id') id:string,
    @Body() body:{paymentReference:string;paymentMethod:string;paidAt?:string},
    @Req() req:any
  ){
    return this.service.markPaid(
      id,{
        paymentReference:body.paymentReference,
        paymentMethod:body.paymentMethod,
        paidAt:body.paidAt?new Date(body.paidAt):undefined
      },
      req.user?.personId,req.user?.role,req.requestId,req.correlationId??randomUUID()
    ).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE')
  @Post('payout-batches/:id/export-downloads')
  @ApiOperation({operationId:'adminDownloadPayoutReviewArtifact',summary:'稽核並下載固定快照的財務覆核 CSV 或銀行 XLS'})
  download(@Param('id') id:string,@Body() body:PayoutArtifactDownloadDto,@Req() req:any){
    return this.service.downloadPayoutArtifact(id,body.revision,req.user?.personId,req.user?.role,req.requestId??randomUUID(),req.correlationId??randomUUID()).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE')
  @Post('payout-batches/:id/bank-exports')
  @ApiOperation({operationId:'adminExportBankPayout',summary:'依銀行原始 XLS 範本產生匯款檔；不執行轉帳'})
  bankExport(@Param('id') id:string,@Body() body:BankExportDto,@Req() req:any){
    return this.service.exportBankPayout(id,body,req.user?.personId,req.user?.role,req.requestId??randomUUID(),req.correlationId??randomUUID()).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE')
  @Post('payout-batches/:id/payment-results')
  @ApiOperation({operationId:'adminRecordPayoutPaymentResults',summary:'記錄公司銀行付款結果；不觸發銀行轉帳'})
  paymentResults(@Param('id') id:string,@Body() body:{results:Array<{payoutLineId:string;status:'PAID'|'FAILED';paidAmount:string;paymentReference?:string;reasonCode?:string;occurredAt?:string}>},@Req() req:any){
    return this.service.recordPayoutResults(id,{results:(body?.results??[]).map(row=>({...row,occurredAt:row.occurredAt?new Date(row.occurredAt):undefined}))},req.user?.personId,req.user?.role,req.requestId,req.correlationId??randomUUID()).then(data=>({data}));
  }
}
