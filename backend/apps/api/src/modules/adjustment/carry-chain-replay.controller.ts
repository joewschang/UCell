import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CarryChainReplayService } from './carry-chain-replay.service';

@ApiTags('Admin - Carry Chain Replay')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/replays')
export class CarryChainReplayController {
  constructor(private readonly service:CarryChainReplayService){}

  @Post('returns/:returnCaseId')
  @ApiOperation({summary:'由退貨來源交易開始，逐週重放Binary/Matching至Carry收斂'})
  async run(@Param('returnCaseId') id:string,@Body() body:{maxWeeks?:number}){
    return {data:await this.service.runForReturn(id,body?.maxWeeks ?? 260)};
  }
}
