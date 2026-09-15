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
      const latest=await this.prisma.bonusAwardLifecycleEvent.findFirst({
        where:{bonusAwardId:award.bonusAwardId},
        orderBy:{occurredAt:'desc'}
      });
      if(latest?.status!=='PENDING_45D') continue;

      await this.prisma.bonusAwardLifecycleEvent.create({
        data:{
          bonusAwardId:award.bonusAwardId,
          status:'EFFECTIVE',
          occurredAt:now
        }
      });
      matured++;
    }
    return {matured};
  }
}
