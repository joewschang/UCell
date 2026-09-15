import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

@Injectable()
export class BonusLifecycleService {
  constructor(private readonly prisma:PrismaService){}

  async matureDueAwards(now=new Date()){
    const awards=await this.prisma.bonusAward.findMany({
      where:{pendingUntil:{lte:now}},
      take:500
    });

    let matured=0;
    for(const award of awards){
      const appended=await this.prisma.$transaction(async tx=>{
      // Serialize delivery per immutable award; append and latest-state check share ownership.
      await tx.$queryRaw`SELECT bonus_award_id FROM ledger.bonus_award WHERE bonus_award_id=${award.bonusAwardId}::uuid FOR UPDATE`;
      const latest=await tx.bonusAwardLifecycleEvent.findFirst({
        where:{bonusAwardId:award.bonusAwardId},
        orderBy:{occurredAt:'desc'}
      });
      if(latest?.status!=='PENDING_45D') return false;

      await tx.bonusAwardLifecycleEvent.create({
        data:{
          bonusAwardId:award.bonusAwardId,
          status:'EFFECTIVE',
          occurredAt:now
        }
      });
      return true;
      });
      if(appended) matured++;
    }
    return {matured};
  }
}
