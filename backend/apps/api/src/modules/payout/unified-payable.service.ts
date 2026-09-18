import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaService, isReservoirBSource } from '@ucell/database';
import { RecoveryBalanceService } from './recovery-balance.service';

@Injectable()
export class UnifiedPayableService {
  constructor(private readonly prisma:PrismaService,private readonly recovery:RecoveryBalanceService){}

  async materialize(cutoff:Date,ruleVersionCode='R1.0B'){
    if(!Number.isFinite(cutoff.getTime())) throw new BadRequestException('PAYOUT_CUTOFF_INVALID');
    return this.prisma.$transaction(async tx=>{
      const awards=await tx.bonusAward.findMany({where:{ruleVersionCode,pendingUntil:{lte:cutoff},lifecycleEvents:{some:{status:'EFFECTIVE'}}}});
      let created=0;
      for(const a of awards){
        if(await isReservoirBSource(tx,a.bonusAwardId))continue;
        if(a.payableAmount.lte(0)) continue;
        const exists=await tx.payableEntry.findUnique({where:{sourceType_sourceId:{sourceType:'BONUS_AWARD',sourceId:a.bonusAwardId}}});
        if(exists) continue;
        await tx.payableEntry.create({data:{qualificationId:a.recipientQualificationId,sourceType:'BONUS_AWARD',sourceId:a.bonusAwardId,awardType:a.awardType,grossAmount:a.payableAmount,availableAt:cutoff,status:'OPEN',ruleVersionCode}});
        created++;
      }
      const globalAwards=await tx.globalPoolAward.findMany({where:{payableAmount:{gt:0}}});
      for(const a of globalAwards){
        if(await isReservoirBSource(tx,a.globalPoolAwardId))continue;
        const exists=await tx.payableEntry.findUnique({where:{sourceType_sourceId:{sourceType:'GLOBAL_POOL_AWARD',sourceId:a.globalPoolAwardId}}});
        if(exists) continue;
        await tx.payableEntry.create({data:{qualificationId:a.qualificationId,sourceType:'GLOBAL_POOL_AWARD',sourceId:a.globalPoolAwardId,awardType:'GLOBAL',grossAmount:a.payableAmount,availableAt:cutoff,status:'OPEN',ruleVersionCode}});
        created++;
      }
      const rpv=await tx.rpvUplineAwardEvent.findMany({where:{payableAmount:{gt:0}}});
      for(const a of rpv){
        if(await isReservoirBSource(tx,a.rpvAwardEventId))continue;
        const exists=await tx.payableEntry.findUnique({where:{sourceType_sourceId:{sourceType:'RPV_UPLINE_AWARD',sourceId:a.rpvAwardEventId}}});
        if(exists) continue;
        await tx.payableEntry.create({data:{qualificationId:a.recipientQualificationId,sourceType:'RPV_UPLINE_AWARD',sourceId:a.rpvAwardEventId,awardType:'RPV',grossAmount:a.payableAmount,availableAt:cutoff,status:'OPEN',ruleVersionCode:a.ruleVersionCode}});
        created++;
      }
      return {created};
    });
  }

  async createPayoutBatch(periodStart:Date,periodEnd:Date,ruleVersionCode='R1.0B'){
    if(!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) || periodEnd<=periodStart)
      throw new BadRequestException('PAYOUT_PERIOD_INVALID: periodEnd must be later than periodStart');
    return this.prisma.$transaction(async tx=>{
      const entries=await tx.payableEntry.findMany({where:{status:'OPEN',availableAt:{lte:periodEnd},ruleVersionCode},orderBy:[{qualificationId:'asc'},{createdAt:'asc'}]});
      const byQ=new Map<string,typeof entries>();
      for(const e of entries){const a=byQ.get(e.qualificationId)??[];a.push(e);byQ.set(e.qualificationId,a);}
      const batch=await tx.payoutBatch.create({data:{periodStart,periodEnd,status:'DRAFT'}});
      let totalGross=new Prisma.Decimal(0),totalRecovery=new Prisma.Decimal(0),totalNet=new Prisma.Decimal(0);
      for(const [qid,rows] of byQ){
        const gross=rows.reduce((x,e)=>x.add(e.grossAmount),new Prisma.Decimal(0));
        const line=await tx.payoutLine.create({data:{payoutBatchId:batch.payoutBatchId,recipientQualificationId:qid,grossAmount:gross,recoveryOffset:new Prisma.Decimal(0),netAmount:gross,detailJson:{payableEntryIds:rows.map(e=>e.payableEntryId)}}});
        const applied=await this.recovery.apply(tx,{qualificationId:qid,payoutLineId:line.payoutLineId,maxAmount:gross});
        const net=gross.sub(applied.applied);
        await tx.payoutLine.update({where:{payoutLineId:line.payoutLineId},data:{recoveryOffset:applied.applied,netAmount:net}});
        for(const e of rows) await tx.payableEntry.update({where:{payableEntryId:e.payableEntryId},data:{status:'ALLOCATED',payoutLineId:line.payoutLineId}});
        totalGross=totalGross.add(gross);totalRecovery=totalRecovery.add(applied.applied);totalNet=totalNet.add(net);
      }
      return tx.payoutBatch.update({where:{payoutBatchId:batch.payoutBatchId},data:{status:'READY',totalGross,totalRecovery,totalNet}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
