import { Roles } from '../auth/roles.decorator';
import { Body,Controller,Get,Headers,Param,Post,Query,Req } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { AdminOperationsService } from './admin-operations.service';

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

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
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
}
