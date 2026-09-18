import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QualificationWorkflowService } from './qualification-workflow.service';

@ApiTags('Admin - Qualification Workflow')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/qualification-workflows')
export class QualificationWorkflowController {
  constructor(private readonly service:QualificationWorkflowService){}

  @Post()
  @ApiOperation({summary:'建立並提交升級/轉讓/退出/公司再轉讓Workflow'})
  async submit(@Body() body:any){
    return {data:await this.service.submit(body)};
  }

  @Post(':id/approve')
  @ApiOperation({summary:'核准Workflow；僅向未來生效'})
  async approve(@Param('id') id:string,@Body() body:{effectiveAt?:string},@Req() req:any){
    return {data:await this.service.approve(id,body.effectiveAt?new Date(body.effectiveAt):undefined,req.user)};
  }
}
