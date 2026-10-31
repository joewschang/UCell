import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Param, Post, Query, ParseUUIDPipe } from '@nestjs/common';
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

  @Get('qualifications/:qualificationId/opportunities')
  @ApiOperation({operationId:'adminListBonusOpportunities',summary:'未取得獎金機會與 LINE 發送證據'})
  async opportunities(@Param('qualificationId',new ParseUUIDPipe()) id:string){
    const rows=await this.prisma.bonusOpportunity.findMany({where:{qualificationId:id},orderBy:[{occurredAt:'desc'},{bonusOpportunityId:'desc'}],take:200});
    const corrections=await this.prisma.outboxEvent.findMany({where:{eventType:'BONUS_OPPORTUNITY_CORRECTED',aggregateId:{in:rows.map(r=>r.bonusOpportunityId)}},select:{aggregateId:true,payload:true,createdAt:true,processStatus:true},orderBy:{createdAt:'desc'}});
    const correctionKeys=corrections.map(c=>(c.payload as {evidenceHash:string}).evidenceHash);
    const deliveries=await this.prisma.notificationDelivery.findMany({where:{notificationType:'BONUS_OPPORTUNITY',evidenceHash:{in:[...rows.map(r=>r.opportunityKey),...correctionKeys]}},select:{evidenceHash:true,status:true,attemptCount:true,sentAt:true,failureCode:true,providerCorrelation:true}});
    return {data:rows.map(row=>({...row,corrections:corrections.filter(c=>c.aggregateId===row.bonusOpportunityId).map(c=>({...c,delivery:deliveries.find(d=>d.evidenceHash===(c.payload as {evidenceHash:string}).evidenceHash)??null})),delivery:deliveries.find(d=>d.evidenceHash===row.opportunityKey)??null})),limit:200,truncated:rows.length===200};
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
