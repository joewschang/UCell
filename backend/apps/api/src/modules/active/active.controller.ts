import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveService } from './active.service';
import { OpenActivePeriodDto } from './dto/open-active-period.dto';

@ApiTags('Admin - Active')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/qualifications/:qualificationId/active')
export class ActiveController {
  constructor(private readonly service:ActiveService){}

  @Get('at')
  @ApiOperation({operationId:'adminIsQualificationActiveAt',summary:'查詢指定時點Active'})
  async at(@Param('qualificationId') id:string,@Query('at') at?:string){
    const when=at?new Date(at):new Date();
    return {data:{qualificationId:id,at:when.toISOString(),active:await this.service.isActiveAt(id,when)}};
  }

  @Post('periods')
  @ApiOperation({operationId:'adminOpenActivePeriod',summary:'建立Active有效期間'})
  async open(@Param('qualificationId') id:string,@Body() dto:OpenActivePeriodDto,@Req() req:any){
    return {data:await this.service.openPeriod(id,dto,req.requestId,req.user?.userId)};
  }
}
