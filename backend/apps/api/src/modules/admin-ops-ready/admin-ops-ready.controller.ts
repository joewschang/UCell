import { Roles } from '../auth/roles.decorator';
import { Body,Controller,Get,Param,Post,Query,Req } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { AdminOpsReadyService } from './admin-ops-ready.service';

@ApiTags('Admin - Operations Ready')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN')
@Controller('admin/ops-ready')
export class AdminOpsReadyController{
  constructor(private readonly service:AdminOpsReadyService){}

  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS','COMPLIANCE_AUDIT')
  @Post('attachments')
  @ApiOperation({operationId:'adminRegisterAttachment',summary:'登錄外部儲存之原始文件Metadata/Hash；不覆寫舊版本'})
  attachment(@Body() body:any,@Req() req:any){
    return this.service.registerAttachment(
      body,req.user?.personId,req.requestId,req.correlationId??randomUUID()
    ).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS','COMPLIANCE_AUDIT')
  @Get('attachments')
  @ApiOperation({operationId:'adminListAttachments',summary:'依Entity查附件版本'})
  attachments(@Query('entityType') entityType:string,@Query('entityId') entityId:string){
    return this.service.attachments(entityType,entityId).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','COMPLIANCE_AUDIT')
  @Get('audit-events')
  @ApiOperation({operationId:'adminAuditSearch',summary:'Audit Viewer'})
  audit(
    @Query('entityType') entityType?:string,@Query('entityId') entityId?:string,
    @Query('action') action?:string,@Query('actorId') actorId?:string,
    @Query('correlationId') correlationId?:string,
    @Query('from') from?:string,@Query('to') to?:string,@Query('take') take?:string
  ){
    return this.service.auditEvents({
      entityType,entityId,action,actorId,correlationId,
      from:from?new Date(from):undefined,to:to?new Date(to):undefined,
      take:Number(take??100)
    }).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('reports/operations')
  @ApiOperation({operationId:'adminOperationsReport',summary:'營運彙總報表'})
  report(@Query('from') from:string,@Query('to') to:string){
    return this.service.operationsReport(new Date(from),new Date(to)).then(data=>({data}));
  }

  @Roles('SUPER_ADMIN','COMPLIANCE_AUDIT')
  @Get('integrity-alerts')
  @ApiOperation({operationId:'adminIntegrityAlerts',summary:'資料/帳務完整性異常檢查'})
  integrity(){return this.service.integrityAlerts().then(data=>({data}));}

  @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
  @Get('exports/:dataset')
  @ApiOperation({operationId:'adminCsvExport',summary:'Qualifications/Orders/Payouts CSV匯出'})
  export(@Param('dataset') dataset:'QUALIFICATIONS'|'ORDERS'|'PAYOUTS',@Query('take') take?:string){
    return this.service.exportDataset(dataset,Number(take??5000)).then(data=>({data}));
  }
}
