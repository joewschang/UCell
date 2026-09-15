import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@ucell/database';
import { BinaryBonusService } from './binary-bonus.service';
import { BonusLifecycleService } from './bonus-lifecycle.service';
import { ReferralBonusService } from './referral-bonus.service';

@ApiTags('Admin - Bonus Engine')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/bonus')
export class BonusController {
  constructor(
    private readonly prisma:PrismaService,
    private readonly referral:ReferralBonusService,
    private readonly binary:BinaryBonusService,
    private readonly lifecycle:BonusLifecycleService,
  ){}

  @Post('settlements/referral')
  @ApiOperation({operationId:'adminSettleReferralK0',summary:'結算推薦＋推薦對等池 K0'})
  async referralSettle(@Body() body:{periodStart:string;periodEnd:string}){
    return {data:await this.referral.settle(new Date(body.periodStart),new Date(body.periodEnd))};
  }

  @Post('settlements/binary')
  @ApiOperation({operationId:'adminSettleBinaryK1',summary:'週結算Binary＋Carry＋K1'})
  async binarySettle(@Body() body:{periodStart:string;periodEnd:string}){
    return {data:await this.binary.settleBinary(new Date(body.periodStart),new Date(body.periodEnd))};
  }

  @Post('settlements/matching')
  @ApiOperation({operationId:'adminSettleMatchingK2',summary:'依Binary實際Paid結算Matching K2'})
  async matchingSettle(@Body() body:{periodStart:string;periodEnd:string}){
    return {data:await this.binary.settleMatching(new Date(body.periodStart),new Date(body.periodEnd))};
  }

  @Post('lifecycle/mature')
  @ApiOperation({operationId:'adminMatureDueAwards',summary:'將到期PENDING_45D獎金轉EFFECTIVE'})
  async mature(){ return {data:await this.lifecycle.matureDueAwards()}; }

  @Get('qualifications/:qualificationId/awards')
  @ApiOperation({operationId:'adminListQualificationAwards',summary:'Qualification獎金明細'})
  async awards(
    @Param('qualificationId') id:string,
    @Query('type') type?:'REFERRAL'|'EQUALIZATION'|'BINARY'|'MATCHING'
  ){
    return {data:await this.prisma.bonusAward.findMany({
      where:{recipientQualificationId:id,awardType:type},
      include:{lifecycleEvents:{orderBy:{occurredAt:'asc'}}},
      orderBy:{occurredAt:'desc'},take:200
    })};
  }
}
